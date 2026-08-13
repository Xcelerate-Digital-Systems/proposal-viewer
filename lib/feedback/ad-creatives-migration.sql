-- Add ad_creatives JSONB column to review_items and review_item_versions
-- Stores an array of { id, url, format, filename? } objects for multi-format
-- ad creatives (e.g. square 1:1 + vertical 9:16).

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS ad_creatives jsonb DEFAULT NULL;

ALTER TABLE review_item_versions
  ADD COLUMN IF NOT EXISTS ad_creatives jsonb DEFAULT NULL;

COMMENT ON COLUMN review_items.ad_creatives IS
  'JSONB array of {id, url, format, filename?} for multi-format ad creatives. NULL when single-format (use ad_creative_url).';

COMMENT ON COLUMN review_item_versions.ad_creatives IS
  'JSONB array of {id, url, format, filename?} for multi-format ad creatives. NULL when single-format (use ad_creative_url).';
