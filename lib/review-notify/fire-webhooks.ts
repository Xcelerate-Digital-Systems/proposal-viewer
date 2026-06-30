// lib/review-notify/fire-webhooks.ts
// Dispatches outbound webhooks for review/campaign events.

import { createServiceClient } from '@/lib/supabase-server';
import { buildReviewUrl } from '@/lib/proposal-url';
import { isValidWebhookUrl } from '@/lib/sanitize';
import crypto from 'crypto';

type ReviewEventType =
  | 'review_comment_added'
  | 'review_comment_resolved'
  | 'review_item_approved'
  | 'review_item_revision_needed'
  | 'review_item_rejected'
  | 'review_feedback_marked_complete'
  | 'review_item_new_version';

export async function fireReviewWebhooks(payload: {
  event_type: ReviewEventType;
  company_id: string;
  custom_domain?: string | null;
  project: { id: string; title: string; client_name: string; share_token: string };
  review_item_id?: string;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
  item_title?: string;
}) {
  const supabase = createServiceClient();

  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', payload.company_id)
    .eq('enabled', true)
    .eq('event_type', payload.event_type);

  if (!webhooks || webhooks.length === 0) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event: payload.event_type,
    timestamp: new Date().toISOString(),
    review_project: {
      id: payload.project.id,
      title: payload.project.title,
      client_name: payload.project.client_name,
      viewer_url: buildReviewUrl(payload.project.share_token, payload.custom_domain, appUrl),
    },
    ...(payload.review_item_id && { review_item_id: payload.review_item_id }),
    ...(payload.item_title && { item_title: payload.item_title }),
    ...(payload.comment_author && {
      comment: { author: payload.comment_author, content: payload.comment_content },
    }),
    ...(payload.resolved_by && { resolved_by: payload.resolved_by }),
  });

  for (const webhook of webhooks) {
    try {
      if (!isValidWebhookUrl(webhook.url)) {
        console.warn(`Skipping review webhook with invalid/private URL: ${webhook.url}`);
        continue;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AgencyViz-Webhooks/1.0',
      };

      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`Review webhook failed for ${webhook.url}:`, err);
    }
  }
}
