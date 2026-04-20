// app/api/ads/creatives/sync-meta/route.ts
//
// Imports a selection of Meta ads into an ad tracker. Per-ad the route:
//   1. Downloads the creative asset from Meta (video source, image, or
//      thumbnail — in that preference order).
//   2. Uploads it to the same Supabase Storage bucket the manual ad-upload
//      flow uses, so the synced creative has a permanent URL that survives
//      Meta rotating or expiring the original asset.
//   3. Inserts an ad_creatives row with status='live', source='meta_sync',
//      and the meta_ad_id/meta_ad_account_id provenance columns.
//   4. Inserts ad_copy_variants for each Advantage+ body/headline/description
//      variant (or just the primary one for non-Advantage+ ads).
//
// Per-ad errors are captured and returned; one bad ad does not abort the
// whole batch.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import type { AdMediaType } from '@/lib/types/ads';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STORAGE_BUCKET = 'company-assets';

interface SyncAdInput {
  meta_ad_id: string;
  meta_ad_account_id: string;
  name: string;
  media_type: AdMediaType;
  image_url?: string | null;
  thumbnail_url?: string | null;
  video_source_url?: string | null;
  primary_text?: string | null;
  headline?: string | null;
  description?: string | null;
  all_primary_texts?: string | null;
  all_headlines?: string | null;
  all_descriptions?: string | null;
  destination_url?: string | null;
}

interface ImportResult {
  meta_ad_id: string;
  id?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be JSON object' }, { status: 400 });
  }

  const { tracker_id, ads } = body as { tracker_id?: unknown; ads?: unknown };
  if (typeof tracker_id !== 'string') {
    return NextResponse.json({ error: 'tracker_id is required' }, { status: 400 });
  }
  if (!Array.isArray(ads) || ads.length === 0) {
    return NextResponse.json({ error: 'ads must be a non-empty array' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify tracker belongs to this company.
  const { data: tracker } = await supabase
    .from('ad_trackers')
    .select('id')
    .eq('id', tracker_id)
    .eq('company_id', auth.companyId)
    .single();
  if (!tracker) {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  // Current max sort_order so new rows append cleanly.
  const { count: existingCount } = await supabase
    .from('ad_creatives')
    .select('*', { count: 'exact', head: true })
    .eq('tracker_id', tracker_id);
  let nextSortOrder = existingCount ?? 0;

  const results: ImportResult[] = [];

  // Serial for the moment — makes per-ad errors easy to attribute and keeps
  // us well inside Supabase Storage rate limits. If batches grow large we can
  // parallelise with bounded concurrency.
  for (const raw of ads as SyncAdInput[]) {
    try {
      const result = await importSingleAd({
        supabase,
        companyId: auth.companyId,
        userId: auth.member.user_id,
        trackerId: tracker_id,
        sortOrder: nextSortOrder,
        ad: raw,
      });
      nextSortOrder += 1;
      results.push({ meta_ad_id: raw.meta_ad_id, id: result.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      console.error(`Meta sync failed for ad ${raw.meta_ad_id}:`, e);
      results.push({ meta_ad_id: raw.meta_ad_id, error: msg });
    }
  }

  const imported = results.filter((r) => r.id);
  const errors = results.filter((r) => r.error);

  return NextResponse.json({
    success: true,
    data: {
      imported: imported.length,
      failed: errors.length,
      results,
    },
  });
}

async function importSingleAd(opts: {
  supabase: ReturnType<typeof createServiceClient>;
  companyId: string;
  userId: string;
  trackerId: string;
  sortOrder: number;
  ad: SyncAdInput;
}): Promise<{ id: string }> {
  const { supabase, companyId, userId, trackerId, sortOrder, ad } = opts;

  if (!ad.meta_ad_id || typeof ad.meta_ad_id !== 'string') {
    throw new Error('meta_ad_id missing');
  }

  // Pick the best asset URL: prefer video source for videos, else image_url,
  // else thumbnail as a last resort.
  const assetUrl =
    (ad.media_type === 'video' ? ad.video_source_url : null) ||
    ad.image_url ||
    ad.thumbnail_url ||
    null;

  let storedUrl: string | null = null;
  if (assetUrl) {
    storedUrl = await downloadAndUpload({
      supabase,
      sourceUrl: assetUrl,
      companyId,
      trackerId,
      metaAdId: ad.meta_ad_id,
      preferVideo: ad.media_type === 'video' && Boolean(ad.video_source_url),
    });
  }

  // Insert the ad_creatives row.
  const { data: creative, error: insertErr } = await supabase
    .from('ad_creatives')
    .insert({
      company_id: companyId,
      tracker_id: trackerId,
      ad_name: ad.name || 'Untitled ad',
      image_url: storedUrl,
      media_type: ad.media_type,
      status: 'live',
      source: 'meta_sync',
      meta_ad_id: ad.meta_ad_id,
      meta_ad_account_id: ad.meta_ad_account_id,
      synced_at: new Date().toISOString(),
      sort_order: sortOrder,
      created_by: userId,
    })
    .select('id')
    .single();

  if (insertErr || !creative) {
    throw new Error(insertErr?.message ?? 'Failed to insert creative');
  }

  // Build ad_copy_variants rows from the Advantage+ variant bundles.
  const variantRows = buildVariantRows(creative.id, ad);
  if (variantRows.length > 0) {
    const { error: variantErr } = await supabase.from('ad_copy_variants').insert(variantRows);
    if (variantErr) {
      // Creative is already inserted. Log and keep going — manual fix is
      // easier than rolling back a partial creative record.
      console.warn(`Failed to insert variants for ${creative.id}: ${variantErr.message}`);
    }
  }

  return { id: creative.id };
}

// Downloads the Meta asset into memory and uploads to Supabase Storage.
// Returns the public URL. Throws on any failure.
async function downloadAndUpload(opts: {
  supabase: ReturnType<typeof createServiceClient>;
  sourceUrl: string;
  companyId: string;
  trackerId: string;
  metaAdId: string;
  preferVideo: boolean;
}): Promise<string> {
  const { supabase, sourceUrl, companyId, trackerId, metaAdId, preferVideo } = opts;

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}) from ${truncateUrl(sourceUrl)}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  const buffer = await res.arrayBuffer();

  const ext = inferExtension(sourceUrl, contentType, preferVideo);
  const path = `ad-creatives/${companyId}/meta-sync/${trackerId}/${metaAdId}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: contentType || (preferVideo ? 'video/mp4' : 'image/jpeg'),
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

function inferExtension(url: string, contentType: string, preferVideo: boolean): string {
  if (contentType) {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('mp4')) return 'mp4';
    if (contentType.includes('quicktime')) return 'mov';
    if (contentType.includes('webm')) return 'webm';
  }
  // Fall back to URL path.
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  })();
  const m = pathname.match(/\.([a-zA-Z0-9]{2,5})(?:$|\?)/);
  if (m) return m[1].toLowerCase();
  return preferVideo ? 'mp4' : 'jpg';
}

function truncateUrl(url: string): string {
  return url.length > 120 ? `${url.slice(0, 120)}…` : url;
}

// Splits Advantage+ "_all" bundles back into individual rows. Creatives.ts
// joins variants with ' | ' (see joinVariants there) — this is the inverse.
function buildVariantRows(
  adCreativeId: string,
  ad: SyncAdInput,
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  addVariants(rows, adCreativeId, 'primary_text', 'Primary Text', ad.all_primary_texts, ad.primary_text);
  addVariants(rows, adCreativeId, 'headline', 'Headline', ad.all_headlines, ad.headline);
  addVariants(rows, adCreativeId, 'description', 'Description', ad.all_descriptions, ad.description);

  return rows;
}

function addVariants(
  rows: Array<Record<string, unknown>>,
  adCreativeId: string,
  variantType: 'headline' | 'primary_text' | 'description',
  labelPrefix: string,
  allBundle: string | null | undefined,
  primary: string | null | undefined,
): void {
  const contents = splitBundle(allBundle);
  if (contents.length === 0 && primary) contents.push(primary);
  contents.forEach((content, idx) => {
    rows.push({
      ad_creative_id: adCreativeId,
      variant_type: variantType,
      label: contents.length > 1 ? `${labelPrefix} ${idx + 1}` : labelPrefix,
      content,
      sort_order: idx,
    });
  });
}

function splitBundle(bundle: string | null | undefined): string[] {
  if (!bundle) return [];
  return bundle
    .split(' | ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
