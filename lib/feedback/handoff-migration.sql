-- Campaign Handoff feature: add handoff_share_token to review_projects
-- This token gives public access to the handoff page showing approved assets.

ALTER TABLE review_projects
ADD COLUMN IF NOT EXISTS handoff_share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_review_projects_handoff_token
ON review_projects (handoff_share_token)
WHERE handoff_share_token IS NOT NULL;
