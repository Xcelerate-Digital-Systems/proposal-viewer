// app/api/webhooks/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

function sampleProposalPayload(eventType: string) {
  const base = {
    event: eventType,
    timestamp: new Date().toISOString(),
    proposal: {
      id: 'sample-proposal-id-abc123',
      title: 'Website Redesign Proposal',
      client_name: 'Acme Corp',
      client_email: 'client@acme.com',
      crm_identifier: 'CRM-001',
      viewer_url: `${APP_URL}/view/sample-share-token`,
    },
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
    const { endpoint_id } = await req.json();

    if (!endpoint_id) {
      return NextResponse.json({ error: 'endpoint_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpoint_id)
      .single();

    if (error || !endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
    }

    const isReview = REVIEW_EVENT_TYPES.has(endpoint.event_type);
    const payload = isReview
      ? sampleReviewPayload(endpoint.event_type)
      : sampleProposalPayload(endpoint.event_type);

    const body = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AgencyViz-Webhooks/1.0',
      'X-Webhook-Test': 'true',
    };

    if (endpoint.secret) {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body,
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