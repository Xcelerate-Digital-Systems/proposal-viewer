// lib/notification-webhooks.ts
// Webhook dispatch for proposal events.

import { createServiceClient } from './supabase-server';
import { buildProposalUrl } from './proposal-url';
import crypto from 'crypto';
import type { WebhookPayload } from './notification-types';
import { isValidWebhookUrl } from './sanitize';

export type { WebhookPayload };

export async function fireWebhooks(payload: WebhookPayload) {
  const supabase = createServiceClient();
  const { event_type, company_id, custom_domain } = payload;

  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', company_id)
    .eq('enabled', true)
    .eq('event_type', event_type);

  if (!webhooks || webhooks.length === 0) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event:     event_type,
    timestamp: new Date().toISOString(),
    proposal: {
      id:             payload.proposal.id,
      title:          payload.proposal.title,
      client_name:    payload.proposal.client_name,
      client_email:   payload.proposal.client_email,
      crm_identifier: payload.proposal.crm_identifier,
      viewer_url:     buildProposalUrl(payload.proposal.share_token, custom_domain, appUrl),
    },
    ...(payload.comment_id && {
      comment: {
        id:      payload.comment_id,
        author:  payload.comment_author,
        content: payload.comment_content,
      },
    }),
    ...(payload.resolved_by && { resolved_by: payload.resolved_by }),
    ...(payload.feedback_text && { feedback_text: payload.feedback_text }),
    ...(payload.feedback_by   && { feedback_by:   payload.feedback_by }),
  });

  for (const webhook of webhooks) {
    try {
      if (!isValidWebhookUrl(webhook.url)) {
        console.warn(`Skipping webhook with invalid/private URL: ${webhook.url}`);
        continue;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent':   'AgencyViz-Webhooks/1.0',
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`Webhook failed for ${webhook.url}:`, err);
    }
  }
}
