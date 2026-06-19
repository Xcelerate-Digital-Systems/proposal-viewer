// app/api/billing/subscription/route.ts
//
// GET /api/billing/subscription
// Returns the active company's subscription joined with its plan, plus
// derived UI state (trial days remaining, whether the workspace is in
// good standing). The Billing tab + AuthGuard trial banner both consume
// this. Read-only — never mutates Stripe.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import {
  getDefaultPlan,
  getPlanById,
  getSubscriptionForCompany,
  trialDaysRemaining,
} from '@/lib/billing/plan';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await authRateLimit(auth.companyId, 'billing/subscription');
    if (limited) return limited;


    const sub = await getSubscriptionForCompany(auth.companyId);
    const plan = sub
      ? await getPlanById(sub.plan_id)
      : await getDefaultPlan(); // Pre-checkout: show the plan they'd be subscribing to.

    const daysRemaining = sub ? trialDaysRemaining(sub) : null;

    return NextResponse.json({
      subscription: sub,
      plan,
      trial_days_remaining: daysRemaining,
    });
  } catch (err) {
    console.error('Subscription GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
