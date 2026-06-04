-- email_log: tracks every outbound email with Resend delivery status.
-- Resend webhook events (delivered, opened, bounced, etc.) update rows
-- via the resend_id correlation key.

CREATE TABLE IF NOT EXISTS email_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id     uuid        REFERENCES companies(id) ON DELETE SET NULL,
  resend_id      text        UNIQUE,
  to_email       text        NOT NULL,
  from_email     text,
  subject        text,
  category       text        NOT NULL,
  event_type     text,
  entity_type    text,
  entity_id      uuid,
  status         text        NOT NULL DEFAULT 'sent',
  delivered_at   timestamptz,
  opened_at      timestamptz,
  clicked_at     timestamptz,
  bounced_at     timestamptz,
  bounce_reason  text,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_company    ON email_log (company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_resend     ON email_log (resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_log_to         ON email_log (to_email, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_entity     ON email_log (entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_log_status     ON email_log (status) WHERE status != 'sent';

-- RLS: service_role has full access. Authenticated users can read their company's log.
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_log_service_all ON email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY email_log_read_own ON email_log
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT tm.company_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Purge entries older than 90 days to prevent unbounded growth.
CREATE OR REPLACE FUNCTION purge_stale_email_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM email_log WHERE created_at < now() - interval '90 days';
$$;

REVOKE EXECUTE ON FUNCTION purge_stale_email_log() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_stale_email_log() TO service_role;
