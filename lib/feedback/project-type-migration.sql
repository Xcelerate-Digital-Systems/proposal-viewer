-- Project type expansion: campaign, asset, website
-- Adds project_type to review_projects and hierarchy fields to review_items

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'campaign'
  CHECK (project_type IN ('campaign', 'asset', 'website'));

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS parent_item_id uuid
  REFERENCES review_items(id) ON DELETE SET NULL;

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS page_path text;

CREATE INDEX IF NOT EXISTS idx_review_items_parent
  ON review_items(parent_item_id)
  WHERE parent_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_projects_type
  ON review_projects(project_type);
