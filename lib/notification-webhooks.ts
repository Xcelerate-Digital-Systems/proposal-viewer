// lib/notification-webhooks.ts
// Webhook dispatch for proposal events — with delivery logging and retry.

import { createServiceClient } from './supabase-server';
import { buildProposalUrl } from './proposal-url';
import crypto from 'crypto';
import type {
  WebhookPayload, WebhookPricingPage, WebhookPackagePage,
} from './notification-types';
import { isValidWebhookUrl } from './sanitize';
import {
  pricingEffectiveSubtotal, pricingTotalDiscount, pricingTax,
} from './types/packages';

export type { WebhookPayload };

// Single attempt with short timeout — retries happen via a dead-letter queue,
// not in-process. This avoids exceeding Vercel's 10s serverless timeout when
// multiple endpoints are configured or targets are slow.
const DELIVERY_TIMEOUT_MS = 5000;

async function deliverWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

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

  // Fetch pricing pages for this proposal
  let pricingPages: WebhookPricingPage[] = [];
  let packagePages: WebhookPackagePage[] = [];

  try {
    const { data: rawPricing } = await supabase
      .from('proposal_pricing')
      .select('id, title, position, tax_enabled, tax_rate, tax_label, items, optional_items, payment_schedule')
      .eq('proposal_id', payload.proposal.id)
      .eq('enabled', true)
      .order('position');

    if (rawPricing) {
      pricingPages = rawPricing.map((p) => {
        const items = (p.items as { id: string; label: string; description: string; amount: number; qty?: number; unit_price?: number; discount_pct?: number; sort_order: number }[] || []);
        const optItems = (p.optional_items as { id: string; label: string; description: string; amount: number; discount_pct?: number; sort_order: number }[] || []);
        const subtotal = pricingEffectiveSubtotal(items as Parameters<typeof pricingEffectiveSubtotal>[0]);
        const discount = pricingTotalDiscount(items as Parameters<typeof pricingTotalDiscount>[0]);
        const tax = p.tax_enabled ? pricingTax(subtotal, p.tax_rate) : 0;

        return {
          id: p.id,
          title: p.title,
          position: p.position,
          tax_enabled: p.tax_enabled,
          tax_rate: p.tax_rate,
          tax_label: p.tax_label,
          items: items.map((i) => ({
            id: i.id,
            label: i.label,
            description: i.description,
            amount: i.amount,
            qty: i.qty ?? null,
            unit_price: i.unit_price ?? null,
            discount_pct: i.discount_pct ?? null,
          })),
          optional_items: optItems.map((i) => ({
            id: i.id,
            label: i.label,
            description: i.description,
            amount: i.amount,
            discount_pct: i.discount_pct ?? null,
          })),
          payment_schedule: p.payment_schedule,
          subtotal,
          discount,
          tax,
          total: subtotal + tax,
        };
      });
    }
  } catch {
    // Non-critical — deliver webhook without pricing if fetch fails
  }

  try {
    const { data: rawPkgs } = await supabase
      .from('proposal_packages')
      .select('id, title, position, packages')
      .eq('proposal_id', payload.proposal.id)
      .eq('enabled', true)
      .order('position');

    if (rawPkgs) {
      packagePages = rawPkgs.map((p) => {
        const tiers = (p.packages as { id: string; name: string; price: number; price_prefix: string; price_suffix: string; is_recommended: boolean; features: { text: string }[] }[] || []);
        return {
          id: p.id,
          title: p.title,
          position: p.position,
          packages: tiers.map((t) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            price_prefix: t.price_prefix,
            price_suffix: t.price_suffix,
            is_recommended: t.is_recommended,
            features: (t.features || []).map((f) => ({ text: f.text })),
          })),
        };
      });
    }
  } catch {
    // Non-critical
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event:     event_type,
    timestamp: new Date().toISOString(),
    proposal: {
      id:                         payload.proposal.id,
      title:                      payload.proposal.title,
      entity_type:                payload.proposal.entity_type,
      status:                     payload.proposal.status,
      client_name:                payload.proposal.client_name,
      client_email:               payload.proposal.client_email,
      client_organisation:        payload.proposal.client_organisation,
      crm_identifier:             payload.proposal.crm_identifier,
      quote_number:               payload.proposal.quote_number,
      valid_until:                payload.proposal.valid_until,
      viewer_url:                 buildProposalUrl(payload.proposal.share_token, custom_domain, appUrl),
      created_at:                 payload.proposal.created_at,
      updated_at:                 payload.proposal.updated_at,
      sent_at:                    payload.proposal.sent_at,
      first_viewed_at:            payload.proposal.first_viewed_at,
      last_viewed_at:             payload.proposal.last_viewed_at,
      accepted_at:                payload.proposal.accepted_at,
      accepted_by_name:           payload.proposal.accepted_by_name,
      declined_at:                payload.proposal.declined_at,
      declined_by_name:           payload.proposal.declined_by_name,
      decline_reason:             payload.proposal.decline_reason,
      revision_requested_at:      payload.proposal.revision_requested_at,
      revision_requested_by_name: payload.proposal.revision_requested_by_name,
      revision_notes:             payload.proposal.revision_notes,
    },
    ...(pricingPages.length > 0 && { pricing: pricingPages }),
    ...(packagePages.length > 0 && { packages: packagePages }),
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

    const result = await deliverWithRetry(webhook.url, body, headers);

    try {
      await supabase.from('webhook_deliveries').insert({
        webhook_endpoint_id: webhook.id,
        company_id,
        event_type,
        proposal_id: payload.proposal.id,
        request_body: body,
        response_status: result.status,
        success: result.ok,
        error_message: result.error ?? null,
        attempts: 1,
      });
    } catch {
      // Logging is best-effort — don't fail the webhook pipeline
    }

    if (!result.ok) {
      console.error(`Webhook failed for ${webhook.url}: status=${result.status} error=${result.error || ''}`);
    }
  }
}
