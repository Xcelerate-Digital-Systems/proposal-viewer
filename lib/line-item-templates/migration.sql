-- Line item templates — reusable bundles of pricing line items that team
-- members can save from a quote and reload into another. Powers the QuoteWin
-- "From Library" / "Save as Template" buttons on the line items table.
--
-- Items are stored as a JSON array of PricingLineItem-shaped objects; the
-- builder regenerates fresh ids on load so the same template can be used
-- across many quotes without collisions.

CREATE TABLE IF NOT EXISTS line_item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_item_templates_company
  ON line_item_templates(company_id);

ALTER TABLE line_item_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read templates within their own company.
DROP POLICY IF EXISTS "line_item_templates_select_own_company" ON line_item_templates;
CREATE POLICY "line_item_templates_select_own_company" ON line_item_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- API routes use the service role key; RLS is bypassed there. The select
-- policy above is for any future direct supabase-js reads from the client.
