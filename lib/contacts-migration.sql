-- Contacts table: company-scoped address book for reuse across campaigns, proposals, quotes
-- Unique on (company_id, email) so the same person is never duplicated within one agency.

CREATE TABLE IF NOT EXISTS public.contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text,
  organisation text,
  phone       text,
  source      text NOT NULL DEFAULT 'manual',  -- manual | campaign_guest | proposal | quote
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contacts_company_email_unique UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);

-- RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_select ON public.contacts
  FOR SELECT USING (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE USING (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE USING (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Service-role bypass for API routes that upsert contacts server-side
CREATE POLICY contacts_service_all ON public.contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
