// app/api/webhooks/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import crypto from 'crypto';
import { isValidWebhookUrl } from '@/lib/sanitize';
import { rateLimit } from '@/lib/rate-limit';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

function sampleProposalPayload(eventType: string) {
  const now = new Date().toISOString();
  const base = {
    event: eventType,
    timestamp: now,
    proposal: {
      id: 'sample-proposal-id-abc123',
      title: 'Website Redesign Proposal',
      entity_type: 'proposal',
      status: eventType === 'proposal_sent' ? 'sent'
        : eventType === 'proposal_viewed' ? 'viewed'
        : eventType === 'proposal_accepted' ? 'accepted'
        : eventType === 'proposal_declined' ? 'declined'
        : eventType === 'proposal_revision_requested' ? 'revision_requested'
        : 'sent',
      client_name: 'Acme Corp',
      client_email: 'client@acme.com',
      client_organisation: 'Acme Corporation Pty Ltd',
      crm_identifier: 'CRM-001',
      quote_number: null,
      valid_until: null,
      viewer_url: `${APP_URL}/view/sample-share-token`,
      created_at: now,
      updated_at: now,
      sent_at: now,
      first_viewed_at: eventType !== 'proposal_sent' ? now : null,
      last_viewed_at: eventType !== 'proposal_sent' ? now : null,
      accepted_at: eventType === 'proposal_accepted' ? now : null,
      accepted_by_name: eventType === 'proposal_accepted' ? 'Jane Smith' : null,
      declined_at: eventType === 'proposal_declined' ? now : null,
      declined_by_name: eventType === 'proposal_declined' ? 'Jane Smith' : null,
      decline_reason: eventType === 'proposal_declined' ? 'Budget constraints' : null,
      revision_requested_at: eventType === 'proposal_revision_requested' ? now : null,
      revision_requested_by_name: eventType === 'proposal_revision_requested' ? 'Jane Smith' : null,
      revision_notes: eventType === 'proposal_revision_requested' ? 'Please revise the timeline on page 2' : null,
    },
    pricing: [
      {
        id: 'sample-pricing-id-001',
        title: 'Project Pricing',
        position: 1,
        tax_enabled: true,
        tax_rate: 10,
        tax_label: 'GST',
        items: [
          { id: 'li-1', label: 'Discovery & Strategy', description: 'Initial research and planning', amount: 2500, qty: null, unit_price: null, discount_pct: null },
          { id: 'li-2', label: 'Design & Development', description: 'UI/UX design and frontend build', amount: 8500, qty: null, unit_price: null, discount_pct: null },
          { id: 'li-3', label: 'Testing & Launch', description: 'QA, staging, and go-live', amount: 1500, qty: null, unit_price: null, discount_pct: null },
        ],
        optional_items: [
          { id: 'oi-1', label: 'SEO Setup', description: 'On-page SEO optimisation', amount: 1200, discount_pct: null },
        ],
        payment_schedule: null,
        subtotal: 12500,
        discount: 0,
        tax: 1250,
        total: 13750,
      },
    ],
  };

  if (eventType === 'comment_added') {
    return {
      ...base,
      comment: {
        id: 'sample-comment-id-xyz789',
        author: 'Jane Smith',
        content: 'Looks great! Can we adjust the colour scheme on page 3?',
      },
    };
  }

  if (eventType === 'comment_resolved') {
    return {
      ...base,
      resolved_by: 'John Doe',
    };
  }

  return base;
}

function sampleReviewPayload(eventType: string) {
  const base = {
    event: eventType,
    timestamp: new Date().toISOString(),
    review_project: {
      id: 'sample-review-id-def456',
      title: 'Brand Assets Review',
      client_name: 'Acme Corp',
      viewer_url: `${APP_URL}/review/sample-review-token`,
    },
  };

  if (eventType === 'review_comment_added') {
    return {
      ...base,
      review_item_id: 'sample-item-id-ghi789',
      item_title: 'Homepage Design v2',
      comment: {
        author: 'Jane Smith',
        content: 'The hero image needs more contrast.',
      },
    };
  }

  if (eventType === 'review_comment_resolved') {
    return {
      ...base,
      review_item_id: 'sample-item-id-ghi789',
      item_title: 'Homepage Design v2',
      resolved_by: 'John Doe',
    };
  }

  if (eventType === 'review_item_approved') {
    return {
      ...base,
      review_item_id: 'sample-item-id-ghi789',
      item_title: 'Homepage Design v2',
    };
  }

  if (eventType === 'review_item_revision_needed') {
    return {
      ...base,
      review_item_id: 'sample-item-id-ghi789',
      item_title: 'Homepage Design v2',
    };
  }

  return base;
}

const REVIEW_EVENT_TYPES = new Set([
  'review_comment_added',
  'review_comment_resolved',
  'review_item_approved',
  'review_item_revision_needed',
]);

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = await rateLimit({ key: `webhook-test:${auth.companyId}`, limit: 5, windowSeconds: 60 });
    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { endpoint_id } = body;

    if (!endpoint_id) {
      return NextResponse.json({ error: 'endpoint_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpoint_id)
      .eq('company_id', auth.companyId)
      .single();

    if (error || !endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
    }

    const isReview = REVIEW_EVENT_TYPES.has(endpoint.event_type);
    const payload = isReview
      ? sampleReviewPayload(endpoint.event_type)
      : sampleProposalPayload(endpoint.event_type);

    if (!isValidWebhookUrl(endpoint.url)) {
      return NextResponse.json({ error: 'Webhook URL is invalid or points to a private address' }, { status: 400 });
    }

    const requestBody = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AgencyViz-Webhooks/1.0',
      'X-Webhook-Test': 'true',
    };

    if (endpoint.secret) {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(requestBody)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: requestBody,
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}