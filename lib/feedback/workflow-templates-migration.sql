-- Workflow templates for campaigns
-- Lets agencies save and reuse stage/assignee configurations

CREATE TABLE IF NOT EXISTS review_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Array of { stage, assignee_ids, guest_emails }
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Days offset from creation for per-stage due dates, e.g. { "internal_review": 3, "client_review": 7 }
  default_stage_due_offsets JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_company
  ON review_workflow_templates(company_id);

-- RLS
ALTER TABLE review_workflow_templates ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (API routes use service client)
CREATE POLICY "service_role_all" ON review_workflow_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read their company's templates
CREATE POLICY "authenticated_select" ON review_workflow_templates
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT tm.company_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );
