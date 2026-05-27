// lib/billing/plan.ts
//
// Shared lookups for the billing layer. Kept thin in Phase B (just the
// joins needed by the checkout / portal / subscription / webhook routes
// and the Billing tab). Phase D will layer per-resource entitlement
// checks on top of this.

import { createServiceClient } from '@/lib/supabase-server';

export type Plan = {
  id: string;
  slug: string;
  name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  seat_limit: number | null;
  proposal_limit: number | null;
  document_limit: number | null;
  review_limit: number | null;
  whiteboard_limit: number | null;
  meta_connection_limit: number | null;
  ai_daily_quota: number;
  has_custom_domain: boolean;
  features: Record<string, unknown>;
  is_active: boolean;
  is_public: boolean;
};

export type Subscription = {
  company_id: string;
  plan_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status:
    | 'incomplete'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused';
  billing_cycle: 'monthly' | 'yearly' | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Return the active default plan — what we put new customers on. There
 * should always be exactly one is_active row at any given time. If two
 * rows are active we pick the most recent (helps during the brief window
 * when a price-change migration is mid-flight).
 */
export async function getDefaultPlan(): Promise<Plan | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Plan | null) ?? null;
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Plan | null) ?? null;
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as Plan | null) ?? null;
}

export async function getSubscriptionForCompany(
  companyId: string,
): Promise<Subscription | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  return (data as Subscription | null) ?? null;
}

export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Promise<Subscription | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle();
  return (data as Subscription | null) ?? null;
}

export async function findCompanyByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('company_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  return data?.company_id ?? null;
}

/** Days remaining on a trial. Negative if already past. Null if not trialing. */
export function trialDaysRemaining(sub: Pick<Subscription, 'status' | 'trial_ends_at'>): number | null {
  if (sub.status !== 'trialing' || !sub.trial_ends_at) return null;
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
