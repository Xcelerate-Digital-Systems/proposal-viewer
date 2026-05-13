import type { FeedbackItem, FeedbackItemVersion } from '@/lib/supabase';

/**
 * v1 lives on the `review_items` row itself; v2+ live in `review_item_versions`.
 * The helpers below present a unified view so UI doesn't need to branch on
 * "are we looking at v1?" everywhere.
 */

/** Shape returned by {@link selectVersion} — the asset fields that matter per type. */
export type VersionAssets = Pick<
  FeedbackItemVersion,
  | 'url' | 'screenshot_url' | 'html_content'
  | 'ad_headline' | 'ad_copy' | 'ad_cta' | 'ad_creative_url' | 'ad_platform'
  | 'email_subject' | 'email_preheader' | 'email_body'
  | 'sms_body'
  | 'image_url' | 'video_url' | 'pdf_url'
  | 'google_ad_data'
  | 'meta_lead_form_data'
>;

/**
 * Wraps every version (including v1) in a uniform shape so the UI can render
 * the same picker + comment scoping logic against a single array.
 */
export type VersionView = {
  /** null = v1 (the item itself); otherwise the review_item_versions row id. */
  id: string | null;
  versionNumber: number;
  notes: string | null;
  createdAt: string;
  assets: VersionAssets;
};

/** Build an ordered list of versions for an item, v1 first. */
export function buildVersionList(item: FeedbackItem, rows: FeedbackItemVersion[]): VersionView[] {
  const v1: VersionView = {
    id: null,
    versionNumber: 1,
    notes: null,
    createdAt: item.created_at,
    assets: extractAssets(item),
  };
  const rest = [...rows]
    .sort((a, b) => a.version_number - b.version_number)
    .map<VersionView>((r) => ({
      id: r.id,
      versionNumber: r.version_number,
      notes: r.notes,
      createdAt: r.created_at,
      assets: extractAssets(r),
    }));
  return [v1, ...rest];
}

/** Pick the currently-active VersionView based on the item's active_version_id. */
export function getActiveVersion(versions: VersionView[], activeVersionId: string | null): VersionView {
  if (!activeVersionId) return versions[0];
  return versions.find((v) => v.id === activeVersionId) || versions[0];
}

export function extractAssets(src: FeedbackItem | FeedbackItemVersion): VersionAssets {
  return {
    url: src.url,
    screenshot_url: 'screenshot_url' in src ? src.screenshot_url : null,
    html_content: src.html_content,
    ad_headline: src.ad_headline,
    ad_copy: src.ad_copy,
    ad_cta: src.ad_cta,
    ad_creative_url: src.ad_creative_url,
    ad_platform: src.ad_platform,
    email_subject: src.email_subject,
    email_preheader: src.email_preheader,
    email_body: src.email_body,
    sms_body: src.sms_body,
    image_url: src.image_url,
    video_url: src.video_url,
    pdf_url: src.pdf_url,
    google_ad_data: src.google_ad_data,
    meta_lead_form_data: src.meta_lead_form_data,
  };
}

/**
 * Merge a view's assets onto the base item so downstream code can use
 * `item.image_url` etc. directly.
 *
 * v1 *is* the item, so its assets are canonical and overwrite everything.
 * v2+ is a patch — the user only fills in fields they want to change in
 * AddVersionModal, leaving everything else null. Treat null/undefined as
 * "unchanged" so unedited fields fall through to v1's values, otherwise
 * a version that only updates ad_copy would blank out the headline,
 * image, CTA, etc.
 */
export function applyVersion(item: FeedbackItem, version: VersionView): FeedbackItem {
  if (version.id === null) return { ...item, ...version.assets };

  const merged: Record<string, unknown> = { ...item };
  for (const [key, value] of Object.entries(version.assets)) {
    if (value !== null && value !== undefined) merged[key] = value;
  }
  return merged as FeedbackItem;
}
