-- Multi-variant Meta ad copy support.
-- Stores N (primary_text, headline) variants per ad item / version, sharing
-- one creative + CTA + platform. Reviewers switch in a sidebar and pin
-- comments scope to the active variant via the `variant-<id>` view string.
--
-- Legacy ad_headline / ad_copy columns are kept and mirrored from the first
-- variant on save so any non-updated consumer keeps working. When the
-- jsonb array is null/empty the viewer falls back to the legacy fields and
-- pins continue to use the platform-scoped view (facebook_feed/instagram_feed).
--
-- Apply via:
--   psql "$DATABASE_URL" -f lib/feedback/meta-ad-variants-migration.sql
-- or paste into the Supabase SQL editor.

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS meta_ad_variants jsonb;

ALTER TABLE review_item_versions
  ADD COLUMN IF NOT EXISTS meta_ad_variants jsonb;

COMMENT ON COLUMN review_items.meta_ad_variants IS
  'Array of {id, primary_text, headline} variant objects for Meta ad mockups. When non-empty, the variant sidebar replaces the single ad_headline/ad_copy preview. Legacy ad_headline/ad_copy are mirrored from the first variant for backwards compatibility.';

COMMENT ON COLUMN review_item_versions.meta_ad_variants IS
  'Per-version override of the Meta ad variants array. Falls through to the item-level value when null.';
