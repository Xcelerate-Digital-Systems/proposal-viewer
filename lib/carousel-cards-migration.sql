-- Add carousel_cards JSONB column to review_items and review_item_versions
-- Stores carousel card data: [{id, image_url, headline, description, destination_url, filename?}]

ALTER TABLE review_items
ADD COLUMN IF NOT EXISTS carousel_cards jsonb DEFAULT NULL;

ALTER TABLE review_item_versions
ADD COLUMN IF NOT EXISTS carousel_cards jsonb DEFAULT NULL;
