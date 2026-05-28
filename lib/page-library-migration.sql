-- Migration: Create page_library table for reusable individual page templates.
-- Each row is a standalone page that can be imported into any proposal,
-- template, or document. Company-scoped.

CREATE TABLE IF NOT EXISTS public.page_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'pdf',
  title         text NOT NULL DEFAULT '',
  label         text,
  indent        integer NOT NULL DEFAULT 0,
  enabled       boolean NOT NULL DEFAULT true,
  position      integer NOT NULL DEFAULT 0,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_url      text,
  link_label    text,
  orientation   text NOT NULL DEFAULT 'auto',
  show_title    boolean NOT NULL DEFAULT true,
  show_member_badge   boolean NOT NULL DEFAULT false,
  show_client_logo    boolean NOT NULL DEFAULT false,
  prepared_by_member_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_library_company ON public.page_library(company_id);

-- RLS
ALTER TABLE public.page_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_library_select" ON public.page_library
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "page_library_insert" ON public.page_library
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "page_library_update" ON public.page_library
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "page_library_delete" ON public.page_library
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );
