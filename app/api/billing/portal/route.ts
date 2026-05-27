// app/api/billing/portal/route.ts
//
// POST /api/billing/portal
// Creates a Stripe Billing Portal session for the active company so the
// owner/admin can update card, view invoices, cancel, resume, or switch
// monthly ↔ yearly.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { getStripe } from '@/lib/billing/stripe';
import { getSubscriptionForCompany } from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

const PORTAL_LIMIT = 10;
const PORTAL_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = auth.member.role;
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the workspace owner or an admin can manage billing.' },
        { status: 403 },
      );
    }

    const rl = await rateLimit({
      key: `billing:portal:${auth.companyId}`,
      limit: PORTAL_LIMIT,
      windowSeconds: PORTAL_WINDOW_SECONDS,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl, PORTAL_LIMIT) },
      );
    }

    const sub = await getSubscriptionForCompany(auth.companyId);
    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer for this workspace. Start a subscription first.' },
        { status: 400 },
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || '').replace(
      /\/+$/,
      '',
    );

    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Billing portal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
