-- Proposal viewer analytics: track page views, time spent, and engagement.
-- Each row = one page view session (a single viewer opening a proposal).

CREATE TABLE IF NOT EXISTS proposal_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  share_token text NOT NULL,
  viewer_email text,
  viewer_name text,
  viewer_ip text,
  user_agent text,
  device_type text CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  referrer text,
  country text,
  city text,
  pages_viewed integer DEFAULT 1,
  total_time_seconds integer DEFAULT 0,
  page_times jsonb DEFAULT '{}',
  max_scroll_depth real DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_views_proposal ON proposal_views(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_views_company ON proposal_views(company_id);
CREATE INDEX IF NOT EXISTS idx_proposal_views_created ON proposal_views(created_at DESC);

ALTER TABLE proposal_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on proposal_views"
  ON proposal_views FOR ALL
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON proposal_views FROM anon, authenticated;
GRANT SELECT ON proposal_views TO authenticated;
GRANT ALL ON proposal_views TO service_role;
