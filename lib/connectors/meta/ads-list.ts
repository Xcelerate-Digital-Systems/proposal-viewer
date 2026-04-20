// Lists currently-active ads for an ad account and returns them with the
// creative details needed to populate an ad_creatives row in the tracker.
//
// Separate from creatives.ts (which hydrates an insights row) because the
// sync flow doesn't start from insights — it starts from "give me every live
// ad on this account". We still reuse fetchAdCreativesMap for the per-ad
// creative fan-out; this file only adds the "list active ads" step plus a
// best-effort video-source lookup.

import { META_API_VERSION } from './fields';
import { MetaApiError } from './api-client';
import { fetchAdCreativesMap } from './creatives';

const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const VIDEO_IDS_PER_BATCH = 50;

// Historical name — kept for file/function continuity. Represents any ad
// returned by the sync lister, regardless of effective_status.
export interface ActiveAd {
  meta_ad_id: string;
  name: string;
  effective_status: string;
  created_time: string | null; // ISO8601 from Meta; used to sort newest-first
  media_type: 'still' | 'video';
  image_url: string | null;
  thumbnail_url: string | null;
  video_source_url: string | null; // downloadable URL, populated for videos
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  cta_type: string | null;
  destination_url: string | null;
  all_primary_texts: string | null; // Advantage+ variants, pipe-joined
  all_headlines: string | null;
  all_descriptions: string | null;
  preview_url: string | null;
}

interface RawAdListItem {
  id: string;
  name?: string;
  effective_status?: string;
  created_time?: string;
}

// Lists every ad on an ad account (no effective_status filter). Paginates.
// The caller sorts newest-first downstream.
export async function fetchActiveAdIds(
  accessToken: string,
  accountId: string,
): Promise<RawAdListItem[]> {
  const out: RawAdListItem[] = [];
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,name,effective_status,created_time',
    limit: '200',
  });
  let url: string | null = `${BASE_URL}/${accountId}/ads?${params}`;

  while (url) {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      throw new MetaApiError(res.status, parsed);
    }
    const json = JSON.parse(text) as { data?: RawAdListItem[]; paging?: { next?: string } };
    out.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return out;
}

// Fetches /{video_id}?fields=source,picture in batches. Best-effort — videos
// without a downloadable source (e.g. very old ads) resolve to null.
export async function fetchVideoSources(
  accessToken: string,
  videoIds: string[],
): Promise<Map<string, { source: string | null; picture: string | null }>> {
  const map = new Map<string, { source: string | null; picture: string | null }>();
  const unique = Array.from(new Set(videoIds)).filter(Boolean);
  if (unique.length === 0) return map;

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += VIDEO_IDS_PER_BATCH) {
    batches.push(unique.slice(i, i + VIDEO_IDS_PER_BATCH));
  }

  for (const batch of batches) {
    const params = new URLSearchParams({
      ids: batch.join(','),
      access_token: accessToken,
      fields: 'source,picture',
    });
    const res = await fetch(`${BASE_URL}/?${params}`);
    const text = await res.text();
    if (!res.ok) {
      const err = new MetaApiError(res.status, safeJson(text));
      if (err.isAuthError) throw err;
      // Video-source fetch is best-effort — an ad without a playable source
      // still imports fine (we fall back to the thumbnail as the still).
      console.warn(`Meta video-source batch failed (${res.status}): ${text.slice(0, 200)}`);
      continue;
    }
    const json = JSON.parse(text) as Record<string, { source?: string; picture?: string }>;
    for (const [id, node] of Object.entries(json)) {
      if (node && typeof node === 'object') {
        map.set(id, {
          source: node.source ?? null,
          picture: node.picture ?? null,
        });
      }
    }
  }
  return map;
}

export async function fetchActiveAdsWithCreatives(opts: {
  accessToken: string;
  accountId: string;
}): Promise<ActiveAd[]> {
  const listed = await fetchActiveAdIds(opts.accessToken, opts.accountId);
  if (listed.length === 0) return [];

  const adIds = listed.map((ad) => ad.id);
  const creatives = await fetchAdCreativesMap({ accessToken: opts.accessToken, adIds });

  // Collect video_ids so we can resolve download URLs in one batched call.
  const videoIds: string[] = [];
  for (const adId of adIds) {
    const c = creatives.get(adId);
    if (c?.ad_video_id) videoIds.push(c.ad_video_id);
  }
  const videoSources = videoIds.length > 0
    ? await fetchVideoSources(opts.accessToken, videoIds)
    : new Map<string, { source: string | null; picture: string | null }>();

  const out: ActiveAd[] = listed.map((listing) => {
    const creative = creatives.get(listing.id);
    const videoInfo = creative?.ad_video_id ? videoSources.get(creative.ad_video_id) : null;
    const isVideo = Boolean(creative?.ad_video_id || creative?.ad_creative_type === 'VIDEO');

    return {
      meta_ad_id: listing.id,
      name: listing.name ?? creative?.ad_creative_name ?? 'Untitled ad',
      effective_status: listing.effective_status ?? 'UNKNOWN',
      created_time: listing.created_time ?? creative?.ad_created_time ?? null,
      media_type: isVideo ? 'video' : 'still',
      image_url: creative?.ad_image_url ?? null,
      thumbnail_url: creative?.ad_thumbnail_url ?? videoInfo?.picture ?? null,
      video_source_url: videoInfo?.source ?? null,
      primary_text: creative?.ad_primary_text ?? null,
      headline: creative?.ad_headline ?? null,
      description: creative?.ad_description ?? null,
      cta_type: creative?.ad_cta_type ?? null,
      destination_url: creative?.ad_destination_url ?? null,
      all_primary_texts: creative?.ad_primary_text_all ?? null,
      all_headlines: creative?.ad_headline_all ?? null,
      all_descriptions: creative?.ad_description_all ?? null,
      preview_url: creative?.ad_preview_url ?? null,
    };
  });

  // Newest-first. Ads without a created_time sink to the bottom.
  out.sort((a, b) => {
    const ta = a.created_time ? Date.parse(a.created_time) : 0;
    const tb = b.created_time ? Date.parse(b.created_time) : 0;
    return tb - ta;
  });

  return out;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
