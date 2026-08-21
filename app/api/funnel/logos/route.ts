import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Logos are small marks, not artwork. Anything over this is the wrong file. */
const MAX_BYTES = 512 * 1024;

/** Raster only — deliberately no SVG.
 *
 *  The company-assets bucket is public, so an uploaded SVG is a stored-XSS
 *  vector the moment a browser opens its URL directly: SVG is an XML document
 *  and can carry <script> and event handlers. Sanitising it properly needs a
 *  DOM, which a serverless route doesn't have (the installed `dompurify` is
 *  browser-only), and pulling jsdom in for a logo upload isn't a good trade.
 *  PNG/JPEG/WebP cannot execute anything, so the vector is removed rather than
 *  mitigated. Ask for a PNG export — every brand kit has one. */
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Company-uploaded platform logos for the funnel planner's "Runs in" badge.
 *
 * GET    — list this company's logos
 * POST   — multipart upload of one logo
 * DELETE — remove one by id (?id=)
 *
 * Raster formats only — see ALLOWED for why SVG is refused.
 */

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('funnel_custom_logos')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[funnel/logos] GET:', error.message);
    return NextResponse.json({ error: 'Failed to load logos' }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = await rateLimit({ key: `funnel-logo:${auth.companyId}`, limit: 20, windowSeconds: 60 });
    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PNG, JPEG or WebP (SVG is not accepted).' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Logo must be under ${Math.round(MAX_BYTES / 1024)}KB.` },
        { status: 400 },
      );
    }

    const rawName = String(form.get('name') || file.name || 'Logo');
    const name = rawName.replace(/\.[a-z0-9]+$/i, '').slice(0, 60).trim() || 'Logo';

    const body = Buffer.from(await file.arrayBuffer());

    const supabase = createServiceClient();
    // auth.companyId is server-verified — never trust a company id from the body.
    const path = `funnel-logos/${auth.companyId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('company-assets')
      .upload(path, body, { contentType: file.type, upsert: false });

    if (upErr) {
      console.error('[funnel/logos] upload:', upErr.message);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from('company-assets').getPublicUrl(path);

    const { data: row, error: insErr } = await supabase
      .from('funnel_custom_logos')
      .insert({
        company_id: auth.companyId,
        name,
        url: pub.publicUrl,
        storage_path: path,
        created_by: (auth.member as { user_id?: string } | null)?.user_id ?? null,
      })
      .select()
      .single();

    if (insErr || !row) {
      // Don't leave the file orphaned in storage if the row failed.
      await supabase.storage.from('company-assets').remove([path]);
      console.error('[funnel/logos] insert:', insErr?.message);
      return NextResponse.json({ error: 'Failed to save logo' }, { status: 500 });
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error('[funnel/logos] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  // Scope the lookup by company so an id from another tenant can't be deleted.
  const { data: row } = await supabase
    .from('funnel_custom_logos')
    .select('storage_path')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await supabase.storage.from('company-assets').remove([row.storage_path]);
  await supabase.from('funnel_custom_logos').delete().eq('id', id).eq('company_id', auth.companyId);

  // Nodes referencing this logo keep the dead URL and simply stop showing a
  // badge — see the note on funnel_custom_logos about storing the URL directly.
  return NextResponse.json({ success: true });
}
