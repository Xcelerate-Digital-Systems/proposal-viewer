// Creative hydration for the Meta Looker Studio connector.
//
// Creative fields (thumbnails, primary text, headline, CTA, destination URL,
// etc.) don't live on /insights — they live on the /ads node. We fetch them
// via Meta's batch-get endpoint (/?ids=ad1,ad2,...&fields=...) keyed by the
// unique ad_ids present in the insights response.
//
// Modern Meta ads use Advantage+ Creative, which stores multiple text
// variants inside `asset_feed_spec`. We flatten these to a single "primary"
// value (first entry) plus an "_all" pipe-joined variant so reports can
// show either the representative copy or every variant.
//
// Best-effort by design: if /ads fails or an individual ad_id is missing,
// creative fields come back null — insights rows still return successfully.
//
// Batch limit: Meta caps ?ids= at 50 per call. We run batches with bounded
// concurrency to keep end-to-end latency in line with the insights fetch.
import { META_API_VERSION } from './fields';
import { MetaApiError } from './api-client';

const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const AD_IDS_PER_BATCH = 50;
const CREATIVE_CONCURRENCY = 4;

export interface NormalizedCreative {
  ad_status: string | null;
  ad_created_time: string | null;
  ad_updated_time: string | null;
  ad_preview_url: string | null;
  ad_creative_id: string | null;
  ad_creative_name: string | null;
  ad_creative_type: string | null;
  ad_thumbnail_url: string | null;
  ad_image_url: string | null;
  ad_video_id: string | null;
  ad_instagram_permalink: string | null;
  ad_effective_object_story_id: string | null;
  ad_primary_text: string | null;
  ad_headline: string | null;
  ad_description: string | null;
  ad_cta_type: string | null;
  ad_destination_url: string | null;
  ad_display_url: string | null;
  ad_primary_text_all: string | null;
  ad_headline_all: string | null;
  ad_description_all: string | null;
  ad_destination_url_all: string | null;
}

// Null-filled creative used when an ad_id isn't resolvable. Exported so
// callers can splice in a consistent shape for every insights row.
export function emptyCreative(): NormalizedCreative {
  return {
    ad_status: null,
    ad_created_time: null,
    ad_updated_time: null,
    ad_preview_url: null,
    ad_creative_id: null,
    ad_creative_name: null,
    ad_creative_type: null,
    ad_thumbnail_url: null,
    ad_image_url: null,
    ad_video_id: null,
    ad_instagram_permalink: null,
    ad_effective_object_story_id: null,
    ad_primary_text: null,
    ad_headline: null,
    ad_description: null,
    ad_cta_type: null,
    ad_destination_url: null,
    ad_display_url: null,
    ad_primary_text_all: null,
    ad_headline_all: null,
    ad_description_all: null,
    ad_destination_url_all: null,
  };
}

interface RawAd {
  id: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
  preview_shareable_link?: string;
  creative?: RawCreative;
}

interface RawCreative {
  id?: string;
  name?: string;
  object_type?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  instagram_permalink_url?: string;
  effective_object_story_id?: string;
  body?: string;
  title?: string;
  object_story_spec?: {
    link_data?: {
      message?: string;
      name?: string;
      description?: string;
      caption?: string;
      link?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
    video_data?: {
      message?: string;
      title?: string;
      link_description?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
      video_id?: string;
    };
    photo_data?: {
      caption?: string;
      url?: string;
    };
    template_data?: {
      message?: string;
      name?: string;
      description?: string;
      link?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
  };
  asset_feed_spec?: {
    bodies?: Array<{ text?: string }>;
    titles?: Array<{ text?: string }>;
    descriptions?: Array<{ text?: string }>;
    captions?: Array<{ text?: string }>;
    call_to_action_types?: string[];
    link_urls?: Array<{ website_url?: string; display_url?: string }>;
  };
}

// Subset of creative{} fields we pull back. Keeping this narrow keeps the
// /ads response small and under Meta's per-response size caps.
const CREATIVE_SUBFIELDS = [
  'id',
  'name',
  'object_type',
  'thumbnail_url',
  'image_url',
  'video_id',
  'instagram_permalink_url',
  'effective_object_story_id',
  'body',
  'title',
  'object_story_spec',
  'asset_feed_spec',
].join(',');

const AD_FIELDS = [
  'id',
  'effective_status',
  'created_time',
  'updated_time',
  'preview_shareable_link',
  `creative{${CREATIVE_SUBFIELDS}}`,
].join(',');

async function mapPool<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function fetchAdCreativesMap(opts: {
  accessToken: string;
  adIds: string[];
}): Promise<Map<string, NormalizedCreative>> {
  const map = new Map<string, NormalizedCreative>();
  const unique = Array.from(new Set(opts.adIds)).filter(Boolean);
  if (unique.length === 0) return map;

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += AD_IDS_PER_BATCH) {
    batches.push(unique.slice(i, i + AD_IDS_PER_BATCH));
  }

  await mapPool(batches, CREATIVE_CONCURRENCY, async (batch) => {
    const params = new URLSearchParams({
      ids: batch.join(','),
      access_token: opts.accessToken,
      fields: AD_FIELDS,
    });
    const res = await fetch(`${BASE_URL}/?${params}`);
    const text = await res.text();
    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      // Auth errors must propagate so the caller can mark the connection
      // as needs_reauth — same as the insights path does. Everything else
      // is best-effort; log and move on so insights data still renders.
      const err = new MetaApiError(res.status, parsed);
      if (err.isAuthError) throw err;
      console.warn(`Meta /ads batch failed (${res.status}): ${text.slice(0, 200)}`);
      return;
    }
    const json = JSON.parse(text) as Record<string, RawAd>;
    for (const [id, ad] of Object.entries(json)) {
      if (ad && typeof ad === 'object' && ad.id) {
        map.set(id, normalizeAd(ad));
      }
    }
  });

  return map;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function joinVariants(values: Array<string | undefined>): string | null {
  const cleaned = values.filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (cleaned.length === 0) return null;
  // Dedup while preserving order — Advantage+ often repeats the same body.
  const seen = new Set<string>();
  const unique = cleaned.filter((v) => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
  return unique.join(' | ');
}

function normalizeAd(ad: RawAd): NormalizedCreative {
  const creative = ad.creative ?? {};
  const oss = creative.object_story_spec ?? {};
  const link = oss.link_data ?? {};
  const video = oss.video_data ?? {};
  const photo = oss.photo_data ?? {};
  const tmpl = oss.template_data ?? {};
  const afs = creative.asset_feed_spec ?? {};

  const bodies = (afs.bodies ?? []).map((b) => b.text ?? '');
  const titles = (afs.titles ?? []).map((t) => t.text ?? '');
  const descs = (afs.descriptions ?? []).map((d) => d.text ?? '');
  const ctas = afs.call_to_action_types ?? [];
  const websiteUrls = (afs.link_urls ?? []).map((l) => l.website_url ?? '');
  const displayUrls = (afs.link_urls ?? []).map((l) => l.display_url ?? '');

  return {
    ad_status: ad.effective_status ?? null,
    ad_created_time: ad.created_time ?? null,
    ad_updated_time: ad.updated_time ?? null,
    ad_preview_url: ad.preview_shareable_link ?? null,
    ad_creative_id: creative.id ?? null,
    ad_creative_name: creative.name ?? null,
    ad_creative_type: creative.object_type ?? null,
    ad_thumbnail_url: creative.thumbnail_url ?? null,
    ad_image_url: creative.image_url ?? photo.url ?? null,
    ad_video_id: creative.video_id ?? video.video_id ?? null,
    ad_instagram_permalink: creative.instagram_permalink_url ?? null,
    ad_effective_object_story_id: creative.effective_object_story_id ?? null,
    ad_primary_text: firstNonEmpty(
      creative.body,
      link.message,
      video.message,
      tmpl.message,
      photo.caption,
      bodies[0],
    ),
    ad_headline: firstNonEmpty(
      creative.title,
      link.name,
      video.title,
      tmpl.name,
      titles[0],
    ),
    ad_description: firstNonEmpty(
      link.description,
      video.link_description,
      tmpl.description,
      descs[0],
    ),
    ad_cta_type: firstNonEmpty(
      link.call_to_action?.type,
      video.call_to_action?.type,
      tmpl.call_to_action?.type,
      ctas[0],
    ),
    ad_destination_url: firstNonEmpty(
      link.link,
      link.call_to_action?.value?.link,
      video.call_to_action?.value?.link,
      tmpl.link,
      tmpl.call_to_action?.value?.link,
      websiteUrls[0],
    ),
    ad_display_url: firstNonEmpty(link.caption, displayUrls[0]),
    ad_primary_text_all: joinVariants(bodies),
    ad_headline_all: joinVariants(titles),
    ad_description_all: joinVariants(descs),
    ad_destination_url_all: joinVariants(websiteUrls),
  };
}
