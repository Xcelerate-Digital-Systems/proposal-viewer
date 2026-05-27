// lib/billing/stripe.ts
//
// Single source of truth for the Stripe SDK + env. Used by every
// app/api/billing/* route. Don't import `stripe` directly anywhere else.

import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. Set it in env before calling billing routes.',
    );
  }
  // Pin the API version so Stripe doesn't silently change response shapes
  // mid-flight on a backend dashboard upgrade. Bump intentionally when
  // upgrading the SDK — Stripe v22 ships 2026-04-22.dahlia.
  cached = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  return cached;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  return secret;
}

/**
 * Resolve the Stripe price id for a given plan + cycle.
 *
 * Lookup order:
 *   1. Plan-row override (plans.stripe_monthly_price_id / yearly).
 *   2. Process env (STRIPE_PRICE_AGENCY_MONTHLY / YEARLY).
 *
 * The env fallback exists so you can wire Stripe before backfilling the
 * plans table — useful in the first deploy cycle.
 */
export function resolvePriceId(args: {
  cycle: 'monthly' | 'yearly';
  planMonthlyPriceId: string | null;
  planYearlyPriceId: string | null;
}): string | null {
  const { cycle, planMonthlyPriceId, planYearlyPriceId } = args;
  if (cycle === 'monthly') {
    return planMonthlyPriceId || process.env.STRIPE_PRICE_AGENCY_MONTHLY || null;
  }
  return planYearlyPriceId || process.env.STRIPE_PRICE_AGENCY_YEARLY || null;
}
