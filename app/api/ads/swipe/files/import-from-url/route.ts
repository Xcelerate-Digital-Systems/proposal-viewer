// app/api/ads/swipe/files/import-from-url/route.ts
//
// Convenience endpoint for the Agency Viz Chrome extension. Accepts ad
// metadata + a media URL (typically a Meta CDN signed URL), downloads the
// media server-side, uploads it to Supabase Storage, and inserts a
// swipe_files row in one call.
//
// Why server-side download? Meta CDN URLs are short-lived signed URLs that
// also block cross-origin fetches from chrome-extension:// — so the extension
// cannot upload them itself. We do it from the server, then store the
// permanent Supabase URL.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { corsPreflight, withCors } from '@/lib/cors';
import { canAccessType, visibleTypesOrFilter } from '@/lib/swipe-files/access';
import { isValidWebhookUrl } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
]);

const EXT_BY_CT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const MAX_BYTES = 100 * 1024 * 1024; // 100MB — matches the upload route cap

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const body = await req.json();
    const {
      type_id,
      type_name,
      title,
      brand,
      headline,
      primary_text,
      description,
      cta,
      tags,
      source_url,
      media_src_url,
      thumbnail_src_url,
    } = body as Record<string, unknown>;

    const supabase = createServiceClient();

    // Resolve target type — accept either type_id or type_name (case-insensitive).
    // Accepts folders the caller owns OR folders shared with them.
    let resolvedType: { id: string; company_id: string; shared_with_company_ids: string[] | null } | null = null;
    if (typeof type_id === 'string' && type_id.length > 0) {
      const { data: t } = await supabase
        .from('swipe_types')
        .select('id, company_id, shared_with_company_ids')
        .eq('id', type_id)
        .single();
      if (t && canAccessType(t, auth.companyId)) resolvedType = t;
    } else if (typeof type_name === 'string' && type_name.length > 0) {
      const { data: t } = await supabase
        .from('swipe_types')
        .select('id, company_id, shared_with_company_ids')
        .or(visibleTypesOrFilter(auth.companyId))
        .ilike('name', type_name)
        .limit(1)
        .single();
      if (t) resolvedType = t;
    }

    if (!resolvedType) {
      return withCors(
        NextResponse.json({ error: 'type_id or type_name not found for this company' }, { status: 400 })
      );
    }
    const resolvedTypeId = resolvedType.id;
    const owningCompanyId = resolvedType.company_id;

    // Download the media (if provided)
    let media_url: string | null = null;
    let media_type: 'image' | 'video' | null = null;
    let thumbnail_url: string | null = null;

    if (typeof media_src_url === 'string' && media_src_url.length > 0) {
      if (!isValidWebhookUrl(media_src_url)) {
        return withCors(NextResponse.json({ error: 'media_src_url not allowed: private/internal addresses are blocked' }, { status: 400 }));
      }
      const uploaded = await downloadAndStore(media_src_url, owningCompanyId, 'media');
      if ('error' in uploaded) {
        return withCors(NextResponse.json({ error: uploaded.error }, { status: 400 }));
      }
      media_url = uploaded.public_url;
      media_type = uploaded.media_type;
    }

    if (typeof thumbnail_src_url === 'string' && thumbnail_src_url.length > 0) {
      if (!isValidWebhookUrl(thumbnail_src_url)) {
        return withCors(NextResponse.json({ error: 'thumbnail_src_url not allowed: private/internal addresses are blocked' }, { status: 400 }));
      }
      const uploaded = await downloadAndStore(thumbnail_src_url, owningCompanyId, 'thumb');
      if (!('error' in uploaded)) thumbnail_url = uploaded.public_url;
    }

    const safeTitle =
      (typeof title === 'string' && title.trim()) ||
      (typeof brand === 'string' && brand.trim()) ||
      (typeof headline === 'string' && headline.trim()) ||
      'Untitled Ad';

    const { data, error } = await supabase
      .from('swipe_files')
      .insert({
        company_id: owningCompanyId,
        type_id: resolvedTypeId,
        title: safeTitle,
        headline: typeof headline === 'string' ? headline.trim() || null : null,
        primary_text: typeof primary_text === 'string' ? primary_text.trim() || null : null,
        description: typeof description === 'string' ? description.trim() || null : null,
        cta: typeof cta === 'string' ? cta.trim() || null : null,
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
        media_type,
        media_url,
        media_source: media_url ? 'upload' : null,
        thumbnail_url,
        source_url: typeof source_url === 'string' ? source_url.trim() || null : null,
        brand: typeof brand === 'string' ? brand.trim() || null : null,
        created_by: auth.member.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error('[api/ads/swipe/files/import-from-url] POST:', error.message);
      return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
    }
    return withCors(NextResponse.json({ success: true, data }, { status: 201 }));
  } catch (err) {
    console.error('Swipe import-from-url error:', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

async function downloadAndStore(
  srcUrl: string,
  companyId: string,
  stub: string
): Promise<{ error: string } | { public_url: string; media_type: 'image' | 'video' }> {
  if (!isValidWebhookUrl(srcUrl)) {
    return { error: 'URL not allowed: private/internal addresses are blocked' };
  }

  let res: Response;
  try {
    res = await fetch(srcUrl, {
      redirect: 'manual',
      // Meta CDN sometimes 403s without a referer/UA
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Referer: 'https://www.facebook.com/',
      },
    });
  } catch (e) {
    return { error: `Failed to fetch media: ${(e as Error).message}` };
  }
  if (!res.ok) return { error: `Media fetch returned ${res.status}` };

  const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(ct)) {
    return { error: `Unsupported media content-type: ${ct || 'unknown'}` };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return { error: `Media exceeds ${MAX_BYTES / 1024 / 1024}MB limit` };
  }

  const ext = EXT_BY_CT[ct] || 'bin';
  const path = `swipe-files/${companyId}/${stub}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabase = createServiceClient();
  const { error: upErr } = await supabase.storage
    .from('company-assets')
    .upload(path, buf, { contentType: ct, upsert: true });
  if (upErr) return { error: `Storage upload failed: ${upErr.message}` };

  const { data: pub } = supabase.storage.from('company-assets').getPublicUrl(path);
  return {
    public_url: pub.publicUrl,
    media_type: ct.startsWith('video/') ? 'video' : 'image',
  };
}
