// lib/billing/entitlements.ts
//
// Plan-driven entitlement checks. Mirrors the increment_ai_usage pattern:
// every billable POST route asks "can this company create one more X?"
// and we answer authoritatively from Postgres.
//
// Grandfathering rules
//   • A company with no `subscriptions` row AND signup_source = 'invite'
//     is treated as grandfathered-unlimited. These are the customers who
//     existed before self-serve billing; locking them out tomorrow would
//     be hostile and they never agreed to a plan.
//   • A company with no subscriptions row AND signup_source ≠ 'invite'
//     (= self_serve or super_admin) is treated as no-plan = blocked.
//     They should have gone through /onboarding which mints a row.
//   • A company whose subscriptions.status ∈ {past_due, unpaid, canceled}
//     AND whose trial has ended is blocked from creating new resources.
//     They still see their data; they just can't add more.
//
// Limits
//   • Each per-resource limit on `plans` is nullable. NULL = unlimited.
//   • The founders plan ships with all NULLs (unlimited everything) except
//     ai_daily_quota = 100. Add caps to the plan row later — no code
//     changes needed when standard pricing launches.

import { createServiceClient } from '@/lib/supabase-server';
import {
  getDefaultPlan,
  getPlanById,
  getSubscriptionForCompany,
  type Plan,
  type Subscription,
} from './plan';

export type Resource =
  | 'proposals'
  | 'documents'
  | 'reviews'
  | 'seats'
  | 'meta_connections';

export type Entitlements = {
  plan: Plan | null;
  subscription: Subscription | null;
  isGrandfathered: boolean;
  /** True if the subscription is in a billable-active state (trialing/active) OR the
   *  company is grandfathered. False = block resource creation. */
  isActive: boolean;
  /** Why the company is blocked, if it is. Used in error messages + UI. */
  inactiveReason:
    | 'no_subscription'
    | 'trial_expired'
    | 'subscription_canceled'
    | 'subscription_past_due'
    | 'subscription_unpaid'
    | null;
  limits: {
    seats: number | null;
    proposals: number | null;
    documents: number | null;
    reviews: number | null;
    metaConnections: number | null;
    aiDaily: number;
  };
};

export type ResourceCheck = {
  allowed: boolean;
  used: number;
  limit: number | null;
  reason: 'ok' | 'inactive' | 'limit_reached';
  inactiveReason: Entitlements['inactiveReason'];
};

/* ── Public API ──────────────────────────────────────────────────────── */

export async function getEntitlements(companyId: string): Promise<Entitlements> {
  const supabase = createServiceClient();

  const [{ data: company }, subscription] = await Promise.all([
    supabase
      .from('companies')
      .select('signup_source')
      .eq('id', companyId)
      .maybeSingle(),
    getSubscriptionForCompany(companyId),
  ]);

  let plan: Plan | null = null;
  if (subscription) {
    plan = await getPlanById(subscription.plan_id);
  } else {
    // Pre-subscription: show what they'd be on if they signed up.
    plan = await getDefaultPlan();
  }

  const signupSource = (company?.signup_source as string | undefined) ?? 'invite';
  const isGrandfathered = !subscription && signupSource === 'invite';

  const { isActive, inactiveReason } = resolveActiveState(subscription, isGrandfathered);

  return {
    plan,
    subscription,
    isGrandfathered,
    isActive,
    inactiveReason,
    limits: {
      seats: plan?.seat_limit ?? null,
      proposals: plan?.proposal_limit ?? null,
      documents: plan?.document_limit ?? null,
      reviews: plan?.review_limit ?? null,
      metaConnections: plan?.meta_connection_limit ?? null,
      aiDaily: plan?.ai_daily_quota ?? 50,
    },
  };
}

export type ResourceUsage = {
  seats: number;
  proposals: number;
  documents: number;
  reviews: number;
  metaConnections: number;
  aiToday: number;
};

export async function getResourceUsage(companyId: string): Promise<ResourceUsage> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: members },
    { count: pendingInvites },
    { count: proposals },
    { count: documents },
    { count: reviews },
    { count: metaConnections },
    { data: aiRow },
  ] = await Promise.all([
    supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase
      .from('company_invites')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString()),
    supabase
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'declined'),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase
      .from('review_projects')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'archived'),
    supabase
      .from('meta_connections')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active'),
    supabase
      .from('ai_usage')
      .select('request_count')
      .eq('company_id', companyId)
      .eq('usage_date', today)
      .maybeSingle(),
  ]);

  return {
    seats: (members ?? 0) + (pendingInvites ?? 0),
    proposals: proposals ?? 0,
    documents: documents ?? 0,
    reviews: reviews ?? 0,
    metaConnections: metaConnections ?? 0,
    aiToday: (aiRow?.request_count as number | undefined) ?? 0,
  };
}

/**
 * Check whether the company can create one more of `resource`. Server-side
 * authority. Routes call this immediately before insert and return 402 on
 * failure so the frontend can show an upgrade prompt.
 */
export async function checkResourceLimit(
  companyId: string,
  resource: Resource,
): Promise<ResourceCheck> {
  const ent = await getEntitlements(companyId);

  if (!ent.isActive) {
    return {
      allowed: false,
      used: 0,
      limit: null,
      reason: 'inactive',
      inactiveReason: ent.inactiveReason,
    };
  }

  const limit = limitFor(ent, resource);
  // NULL limit = unlimited. Allow without counting (saves a query).
  if (limit === null) {
    return { allowed: true, used: 0, limit: null, reason: 'ok', inactiveReason: null };
  }

  // Try atomic check via advisory-lock RPC to prevent TOCTOU races.
  const RESOURCE_TABLE: Record<string, string> = {
    proposals: 'proposals',
    documents: 'documents',
    reviews: 'review_projects',
  };
  const atomicTable = RESOURCE_TABLE[resource];
  if (atomicTable) {
    const supabase = (await import('@/lib/supabase-server')).createServiceClient();
    const { data: allowed, error: rpcErr } = await supabase.rpc('check_resource_limit_atomic', {
      p_company_id: companyId,
      p_table: atomicTable,
      p_limit: limit,
    });
    if (!rpcErr && typeof allowed === 'boolean') {
      const used = await countResource(companyId, resource);
      return allowed
        ? { allowed: true, used, limit, reason: 'ok', inactiveReason: null }
        : { allowed: false, used, limit, reason: 'limit_reached', inactiveReason: null };
    }
  }

  // Fallback: non-atomic count (for seats, meta_connections, or pre-migration DBs)
  const used = await countResource(companyId, resource);
  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      reason: 'limit_reached',
      inactiveReason: null,
    };
  }
  return { allowed: true, used, limit, reason: 'ok', inactiveReason: null };
}

/**
 * AI quota check. Distinct from checkResourceLimit because the existing
 * /api/ai/generate-text route already increments via the atomic RPC and
 * compares against a numeric cap — we only need to provide the cap.
 */
export async function getAiDailyQuota(companyId: string): Promise<number> {
  const ent = await getEntitlements(companyId);
  // Grandfathered legacy companies keep the historical 50/day cap. If they
  // upgrade to a plan, that plan's quota takes over.
  if (ent.isGrandfathered && !ent.subscription) return 50;
  return ent.limits.aiDaily;
}

/* ── Internals ───────────────────────────────────────────────────────── */

function resolveActiveState(
  sub: Subscription | null,
  isGrandfathered: boolean,
): { isActive: boolean; inactiveReason: Entitlements['inactiveReason'] } {
  if (isGrandfathered) return { isActive: true, inactiveReason: null };
  if (!sub) return { isActive: false, inactiveReason: 'no_subscription' };

  switch (sub.status) {
    case 'trialing':
    case 'active':
      return { isActive: true, inactiveReason: null };
    case 'past_due':
      return { isActive: false, inactiveReason: 'subscription_past_due' };
    case 'unpaid':
      return { isActive: false, inactiveReason: 'subscription_unpaid' };
    case 'canceled':
      return { isActive: false, inactiveReason: 'subscription_canceled' };
    case 'incomplete':
    case 'paused':
    default:
      return { isActive: false, inactiveReason: 'no_subscription' };
  }
}

function limitFor(ent: Entitlements, resource: Resource): number | null {
  switch (resource) {
    case 'proposals':
      return ent.limits.proposals;
    case 'documents':
      return ent.limits.documents;
    case 'reviews':
      return ent.limits.reviews;
    case 'seats':
      return ent.limits.seats;
    case 'meta_connections':
      return ent.limits.metaConnections;
  }
}

async function countResource(companyId: string, resource: Resource): Promise<number> {
  const supabase = createServiceClient();
  switch (resource) {
    case 'proposals': {
      const { count } = await supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('status', 'declined');
      return count ?? 0;
    }
    case 'documents': {
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      return count ?? 0;
    }
    case 'reviews': {
      const { count } = await supabase
        .from('review_projects')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('status', 'archived');
      return count ?? 0;
    }
    case 'seats': {
      const [{ count: members }, { count: pending }] = await Promise.all([
        supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId),
        supabase
          .from('company_invites')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString()),
      ]);
      return (members ?? 0) + (pending ?? 0);
    }
    case 'meta_connections': {
      const { count } = await supabase
        .from('meta_connections')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active');
      return count ?? 0;
    }
  }
}

/**
 * Standard 402 response payload for over-limit / inactive cases.
 * Routes return this body so the frontend hook can normalise the handling.
 */
export function buildLimitErrorBody(check: ResourceCheck, resource: Resource) {
  if (check.reason === 'inactive') {
    return {
      error: inactiveErrorMessage(check.inactiveReason),
      code: 'subscription_inactive' as const,
      resource,
      inactive_reason: check.inactiveReason,
    };
  }
  return {
    error: `You've hit your plan's ${resource.replace('_', ' ')} limit (${check.limit}). Upgrade to add more.`,
    code: 'plan_limit_exceeded' as const,
    resource,
    used: check.used,
    limit: check.limit,
  };
}

function inactiveErrorMessage(reason: Entitlements['inactiveReason']): string {
  switch (reason) {
    case 'subscription_canceled':
      return 'Your subscription is canceled. Re-activate it from Settings → Billing to keep working.';
    case 'subscription_past_due':
    case 'subscription_unpaid':
      return 'Your last payment failed. Update your card from Settings → Billing to keep working.';
    case 'no_subscription':
    case 'trial_expired':
    case null:
    default:
      return 'Your workspace doesn’t have an active subscription. Start your trial from Settings → Billing.';
  }
}
