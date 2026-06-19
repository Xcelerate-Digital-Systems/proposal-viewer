// app/api/billing/entitlements/route.ts
//
// GET /api/billing/entitlements
// Returns the active company's plan limits + current per-resource usage in
// a single round-trip. Consumed by hooks/useEntitlements.ts to drive
// upgrade-tooltip hints on the "New proposal" / "Invite teammate" etc
// buttons. Read-only.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { getEntitlements, getResourceUsage } from '@/lib/billing/entitlements';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await authRateLimit(auth.companyId, 'billing/entitlements');
    if (limited) return limited;


    const [ent, usage] = await Promise.all([
      getEntitlements(auth.companyId),
      getResourceUsage(auth.companyId),
    ]);

    return NextResponse.json({
      is_active: ent.isActive,
      is_grandfathered: ent.isGrandfathered,
      inactive_reason: ent.inactiveReason,
      plan: ent.plan
        ? {
            id: ent.plan.id,
            slug: ent.plan.slug,
            name: ent.plan.name,
          }
        : null,
      subscription: ent.subscription
        ? {
            status: ent.subscription.status,
            trial_ends_at: ent.subscription.trial_ends_at,
            current_period_end: ent.subscription.current_period_end,
            cancel_at_period_end: ent.subscription.cancel_at_period_end,
          }
        : null,
      limits: ent.limits,
      usage,
    });
  } catch (err) {
    console.error('GET /api/billing/entitlements error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
