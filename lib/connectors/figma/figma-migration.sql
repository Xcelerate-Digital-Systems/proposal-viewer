-- Figma integration: connection storage + review_items columns for Figma assets.
-- Run via Supabase SQL editor.

-- ─── Figma connections (per team member per company) ────────────

CREATE TABLE IF NOT EXISTS figma_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  figma_user_id text NOT NULL,
  figma_handle  text,
  figma_email   text,
  access_token_encrypted text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, team_member_id)
);

-- RLS: team members can only see their own company's connections
ALTER TABLE figma_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY figma_connections_select ON figma_connections
  FOR SELECT USING (
    company_id IN (
      SELECT tm.company_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY figma_connections_insert ON figma_connections
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT tm.company_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY figma_connections_delete ON figma_connections
  FOR DELETE USING (
    company_id IN (
      SELECT tm.company_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- ─── Add Figma metadata columns to review_items ────────────────

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS figma_file_key    text,
  ADD COLUMN IF NOT EXISTS figma_node_id     text,
  ADD COLUMN IF NOT EXISTS figma_file_name   text,
  ADD COLUMN IF NOT EXISTS figma_frame_name  text,
  ADD COLUMN IF NOT EXISTS figma_version_id  text;

-- Mirror on review_item_versions for versioned Figma assets
ALTER TABLE review_item_versions
  ADD COLUMN IF NOT EXISTS figma_file_key    text,
  ADD COLUMN IF NOT EXISTS figma_node_id     text,
  ADD COLUMN IF NOT EXISTS figma_file_name   text,
  ADD COLUMN IF NOT EXISTS figma_frame_name  text,
  ADD COLUMN IF NOT EXISTS figma_version_id  text;
