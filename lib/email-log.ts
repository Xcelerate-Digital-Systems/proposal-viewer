// lib/email-log.ts
// Wraps Resend email sends with automatic logging to the email_log table.
// Resend webhook events (delivered/opened/bounced) update rows via resend_id.

import { createServiceClient } from './supabase-server';
import { getResend } from './resend';

export type EmailCategory =
  | 'proposal_notification'
  | 'campaign_notification'
  | 'campaign_digest'
  | 'campaign_mention'
  | 'campaign_invite'
  | 'campaign_reminder'
  | 'campaign_task'
  | 'proposal_confirmation'
  | 'billing'
  | 'auth'
  | 'integration_health';

export interface SendAndLogOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  companyId?: string | null;
  category: EmailCategory;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export async function sendAndLogEmail(opts: SendAndLogOptions) {
  const { from, to, subject, html, companyId, category, eventType, entityType, entityId } = opts;

  const { data, error } = await getResend().emails.send({ from, to, subject, html });
  if (error) throw error;

  try {
    const supabase = createServiceClient();
    await supabase.from('email_log').insert({
      company_id: companyId || null,
      resend_id: data?.id || null,
      to_email: to,
      from_email: from,
      subject,
      category,
      event_type: eventType || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
    });
  } catch (err) {
    console.error('email_log insert failed:', err);
  }

  return data;
}
