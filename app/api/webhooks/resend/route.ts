// app/api/webhooks/resend/route.ts
// Receives Resend webhook events (delivered, opened, clicked, bounced,
// complained) and updates the corresponding email_log row via resend_id.
//
// Setup: In Resend dashboard → Webhooks, point to
// https://app.agencyviz.io/api/webhooks/resend and copy the signing secret
// into RESEND_WEBHOOK_SECRET env var.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type ResendEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    [key: string]: unknown;
  };
};

function verifySignature(payload: string, req: NextRequest): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject timestamps older than 5 minutes to prevent replay attacks.
  const ts = parseInt(svixTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Svix signing: HMAC-SHA256(base64decode(secret), "msg_id.timestamp.body")
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  // svix-signature header contains one or more "v1,<base64>" entries.
  const signatures = svixSignature.split(' ');
  return signatures.some((sig) => {
    const value = sig.replace(/^v1,/, '');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(value),
      );
    } catch {
      return false;
    }
  });
}

const STATUS_MAP: Record<string, { status: string; tsColumn: string | null }> = {
  'email.sent':              { status: 'sent',      tsColumn: null },
  'email.delivered':         { status: 'delivered',  tsColumn: 'delivered_at' },
  'email.delivery_delayed':  { status: 'delayed',    tsColumn: null },
  'email.opened':            { status: 'opened',     tsColumn: 'opened_at' },
  'email.clicked':           { status: 'clicked',    tsColumn: 'clicked_at' },
  'email.bounced':           { status: 'bounced',    tsColumn: 'bounced_at' },
  'email.complained':        { status: 'complained', tsColumn: null },
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const mapping = STATUS_MAP[event.type];
  if (!mapping) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const resendId = event.data?.email_id;
  if (!resendId) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const updates: Record<string, unknown> = { status: mapping.status };
    if (mapping.tsColumn) {
      updates[mapping.tsColumn] = event.created_at || new Date().toISOString();
    }
    if (event.type === 'email.bounced') {
      const reason = (event.data as Record<string, unknown>).bounce_type
        || (event.data as Record<string, unknown>).message
        || null;
      if (reason) updates.bounce_reason = String(reason);
    }

    await supabase
      .from('email_log')
      .update(updates)
      .eq('resend_id', resendId);
  } catch (err) {
    console.error('Resend webhook: email_log update failed:', err);
  }

  return NextResponse.json({ ok: true });
}
