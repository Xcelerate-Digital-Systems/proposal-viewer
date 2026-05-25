-- Widget enable/disable switch for the embeddable website feedback widget.
-- Admins can toggle this from the Setup tab to suspend the on-site toolbar
-- + panel without removing the <script> tag from the customer's site.
-- Heartbeat / install detection keep working so the Setup tab still
-- reports accurate install state while the widget is off.
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/widget-enabled-migration.sql

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS widget_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN review_projects.widget_enabled IS
  'When false, the embeddable website feedback widget script returns a no-op so the toolbar/panel never load on the customer site. Heartbeat + install detection still work so the Setup tab keeps reporting install state accurately.';
