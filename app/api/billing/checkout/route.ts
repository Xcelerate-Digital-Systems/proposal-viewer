// app/api/billing/checkout/route.ts
//
// POST /api/billing/checkout
// Body: { billing_cycle: 'monthly' | 'yearly' }
//
// Creates (or reuses) a Stripe customer for the company, then mints a
// Checkout session in subscription mode with a 7-day trial. Card is
// required up front (payment_method_collection: always) and the trial
// auto-cancels if no card is collected — belt-and-braces given Checkout
// already requires the card before completing.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { getStripe, resolvePriceId } from '@/lib/billing/stripe';
import {
  getDefaultPlan,
  getSubscriptionForCompany,
} from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

const CHECKOUT_LIMIT = 10;
const CHECKOUT_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Owners + admins only — billing is workspace-level.
    const role = auth.member.role;
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the workspace owner or an admin can manage billing.' },
        { status: 403 },
      );
    }

    const rl = await rateLimit({
      key: `billing:checkout:${auth.companyId}`,
      limit: CHECKOUT_LIMIT,
      windowSeconds: CHECKOUT_WINDOW_SECONDS,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl, CHECKOUT_LIMIT) },
      );
    }

    const body = await req.json().catch(() => ({}));
    const cycle = body.billing_cycle === 'yearly' ? 'yearly' : 'monthly';

    const plan = await getDefaultPlan();
    if (!plan) {
      return NextResponse.json(
        { error: 'No active plan is configured. Contact support.' },
        { status: 500 },
      );
    }

    const priceId = resolvePriceId({
      cycle,
      planMonthlyPriceId: plan.stripe_monthly_price_id,
      planYearlyPriceId: plan.stripe_yearly_price_id,
    });
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            'Stripe price is not configured yet. Set the price id on the plan row or via env (STRIPE_PRICE_AGENCY_MONTHLY / STRIPE_PRICE_AGENCY_YEARLY).',
        },
        { status: 500 },
      );
    }

    const supabase = createServiceClient();
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', auth.companyId)
      .single();
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const stripe = getStripe();
    const existing = await getSubscriptionForCompany(auth.companyId);

    if (existing && (existing.status === 'active' || existing.status === 'trialing')) {
      return NextResponse.json(
        { error: 'Your workspace already has an active subscription. Manage it from Settings → Billing.' },
        { status: 400 },
      );
    }

    // Reuse the existing Stripe customer if we already minted one for
    // this company on a previous attempt — otherwise create a new one
    // tagged with company_id metadata so the webhook can resolve back.
    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.member.email,
        name: company.name,
        metadata: { company_id: company.id },
      });
      customerId = customer.id;

      // Upsert the placeholder subscriptions row so the webhook handler
      // and a retry of this route can both find the customer id.
      await supabase.from('subscriptions').upsert(
        {
          company_id: company.id,
          plan_id: plan.id,
          stripe_customer_id: customerId,
          status: 'incomplete',
          billing_cycle: cycle,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      );
    } else {
      // Keep the chosen cycle + plan in sync ahead of the webhook firing.
      await supabase
        .from('subscriptions')
        .update({
          plan_id: plan.id,
          billing_cycle: cycle,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', company.id);
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || '').replace(
      /\/+$/,
      '',
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      client_reference_id: company.id,
      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: { missing_payment_method: 'cancel' },
        },
        metadata: { company_id: company.id, plan_id: plan.id },
      },
      metadata: { company_id: company.id, plan_id: plan.id, billing_cycle: cycle },
      success_url: `${appUrl}/onboarding?step=done&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/onboarding?step=plan`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a Checkout URL' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Billing checkout error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
