-- pages-html-type-constraint-migration.sql
--
-- The html page type (sandboxed-iframe render, commit f23a0592) shipped in
-- the UI and pages API, but the *_pages_v2 CHECK constraints were never
-- extended, so inserting an html page always failed with a type_check
-- violation. Discovered 2026-07-31 when exposing type:'html' through the
-- MCP page tools. Additive change: extends the allowed values only.

alter table proposal_pages_v2 drop constraint proposal_pages_v2_type_check;
alter table proposal_pages_v2 add constraint proposal_pages_v2_type_check
  check (type = any (array['pdf'::text, 'text'::text, 'html'::text, 'pricing'::text, 'packages'::text, 'toc'::text, 'section'::text]));

alter table template_pages_v2 drop constraint template_pages_v2_type_check;
alter table template_pages_v2 add constraint template_pages_v2_type_check
  check (type = any (array['pdf'::text, 'text'::text, 'html'::text, 'pricing'::text, 'packages'::text, 'toc'::text, 'section'::text]));

alter table document_pages_v2 drop constraint document_pages_v2_type_check;
alter table document_pages_v2 add constraint document_pages_v2_type_check
  check (type = any (array['pdf'::text, 'text'::text, 'html'::text, 'toc'::text, 'section'::text]));
