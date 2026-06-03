// app/api/billing/webhook/route.ts
//
// POST /api/billing/webhook  (Stripe → us)
//
// Verifies the Stripe signature against the RAW request body (do not call
// req.json() here — JSON.parse mangles whitespace and the HMAC fails),
// dedupes via stripe_webhook_events (Stripe re-delivers occasionally), and
// fans out to per-event handlers that keep the local subscriptions row in
// sync with Stripe's source of truth.

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, getWebhookSecret } from '@/lib/billing/stripe';
import { createServiceClient } from '@/lib/supabase-server';
import {
  findCompanyByStripeCustomerId,
  getPlanBySlug,
  getSubscriptionForCompany,
} from '@/lib/billing/plan';
import {
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendTrialStartedEmail,
  sendSubscriptionCanceledEmail,
} from '@/lib/billing-emails';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    console.error('Stripe webhook signature failure:', msg);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: insert-or-noop. If the event id already exists we've
  // already processed it (Stripe re-delivers up to 3 days on 5xx).
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

  // Postgres unique-violation for duplicate event id -> already processed.
  // Any other insert error: still try to process, but log.
  if (insertError && !/duplicate key|already exists/i.test(insertError.message)) {
    console.error('webhook event log insert error:', insertError.message);
  } else if (insertError) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Many events fire that we don't care about; logging at debug
        // would be noisy. Just acknowledge.
        break;
    }

    await supabase
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Stripe webhook handler error:', message);

    // Permanent / deterministic failures (missing data, bad metadata) should
    // NOT return 500 — that triggers Stripe's 3-day retry storm for an error
    // that will never self-resolve. Return 200 to acknowledge receipt and
    // stop retries. Only truly transient failures (DB timeout, network blip)
    // should 500 so Stripe retries.
    const permanentFailure =
      /not found|missing|invalid|no plan|could not resolve/i.test(message);

    if (permanentFailure) {
      console.error('Stripe webhook permanent failure (will not retry):', message);
      return NextResponse.json({ received: true, error: 'permanent failure' });
    }

    // Transient — 500 so Stripe retries.
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

/* ── Handlers ────────────────────────────────────────────────────────── */

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return;
  const subId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const full = await getStripe().subscriptions.retrieve(subId);
  await handleSubscriptionUpsert(full);
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const companyId = await resolveCompanyId(sub);
  if (!companyId) {
    console.warn(
      `Stripe webhook: subscription ${sub.id} has no resolvable company_id, skipping`,
    );
    return;
  }

  const planId = await resolvePlanId(sub, companyId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const cycle = inferBillingCycle(sub);
  const currentPeriodEnd = currentPeriodEndIso(sub);
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;

  const existing = await getSubscriptionForCompany(companyId);
  const wasTrialing = existing?.status === 'trialing';

  const supabase = createServiceClient();
  await supabase.from('subscriptions').upsert(
    {
      company_id: companyId,
      plan_id: planId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      billing_cycle: cycle,
      trial_ends_at: trialEnd,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: canceledAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  );

  // Send the welcome email exactly once: when status flips to trialing
  // for the first time (no prior subscription row in trialing state).
  if (sub.status === 'trialing' && !wasTrialing) {
    await safeSendTrialStarted(companyId, trialEnd, planId);
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const companyId = await resolveCompanyId(sub);
  if (!companyId) return;
  const supabase = createServiceClient();
  const endsAt = currentPeriodEndIso(sub);
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : new Date().toISOString(),
      current_period_end: endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);

  await safeSendCanceled(companyId, endsAt);
}

async function handleTrialWillEnd(sub: Stripe.Subscription) {
  const companyId = await resolveCompanyId(sub);
  if (!companyId) return;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  if (!trialEnd) return;

  const contact = await loadCompanyContact(companyId);
  if (!contact) return;
  const manageUrl = buildAppUrl('/settings?tab=billing');
  await sendTrialEndingEmail({
    to: contact.email,
    companyName: contact.companyName,
    trialEndsAt: trialEnd,
    manageUrl,
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId) return;
  const companyId = await findCompanyByStripeCustomerId(customerId);
  if (!companyId) return;

  const contact = await loadCompanyContact(companyId);
  if (!contact) return;
  const amount = invoice.amount_due ?? 0;
  const currency = (invoice.currency ?? 'usd').toUpperCase();
  const amountLabel = formatMoney(amount, currency);
  const manageUrl = buildAppUrl('/settings?tab=billing');
  await sendPaymentFailedEmail({
    to: contact.email,
    companyName: contact.companyName,
    amountLabel,
    manageUrl,
  });
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

async function resolveCompanyId(sub: Stripe.Subscription): Promise<string | null> {
  const metaCompanyId =
    typeof sub.metadata?.company_id === 'string' ? sub.metadata.company_id : null;
  if (metaCompanyId) return metaCompanyId;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  return findCompanyByStripeCustomerId(customerId);
}

async function resolvePlanId(sub: Stripe.Subscription, companyId: string): Promise<string> {
  const metaPlanId =
    typeof sub.metadata?.plan_id === 'string' ? sub.metadata.plan_id : null;
  if (metaPlanId) return metaPlanId;

  // Fall back to whatever plan was already on the row, then to founders.
  const existing = await getSubscriptionForCompany(companyId);
  if (existing?.plan_id) return existing.plan_id;

  const founder = await getPlanBySlug('founders');
  if (founder) return founder.id;
  throw new Error('No plan id could be resolved for subscription ' + sub.id);
}

function inferBillingCycle(sub: Stripe.Subscription): 'monthly' | 'yearly' | null {
  const metaCycle = sub.metadata?.billing_cycle;
  if (metaCycle === 'monthly' || metaCycle === 'yearly') return metaCycle;
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === 'month') return 'monthly';
  if (interval === 'year') return 'yearly';
  return null;
}

/**
 * Stripe API 2024-04-10+ moved current_period_end out of the subscription
 * root and into each subscription item. Read from the item first, fall
 * back to the root for older payload shapes.
 */
function currentPeriodEndIso(sub: Stripe.Subscription): string | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const rootCandidate = (sub as unknown as { current_period_end?: number }).current_period_end;
  const secs = fromItem ?? rootCandidate ?? null;
  return secs ? new Date(secs * 1000).toISOString() : null;
}

async function loadCompanyContact(companyId: string): Promise<
  { email: string; companyName: string } | null
> {
  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single();
  if (!company) return null;

  // Prefer the owner; fall back to the oldest admin.
  const { data: owner } = await supabase
    .from('team_members')
    .select('email')
    .eq('company_id', companyId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (owner?.email) return { email: owner.email, companyName: company.name };

  const { data: admin } = await supabase
    .from('team_members')
    .select('email')
    .eq('company_id', companyId)
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (admin?.email) return { email: admin.email, companyName: company.name };

  return null;
}

async function safeSendTrialStarted(
  companyId: string,
  trialEnd: string | null,
  planId: string,
) {
  if (!trialEnd) return;
  const contact = await loadCompanyContact(companyId);
  if (!contact) return;
  const supabase = createServiceClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('name')
    .eq('id', planId)
    .single();
  const manageUrl = buildAppUrl('/settings?tab=billing');
  await sendTrialStartedEmail({
    to: contact.email,
    companyName: contact.companyName,
    planName: plan?.name ?? 'Founders',
    trialEndsAt: trialEnd,
    manageUrl,
  });
}

async function safeSendCanceled(companyId: string, endsAt: string | null) {
  const contact = await loadCompanyContact(companyId);
  if (!contact) return;
  const manageUrl = buildAppUrl('/settings?tab=billing');
  await sendSubscriptionCanceledEmail({
    to: contact.email,
    companyName: contact.companyName,
    endsAt,
    manageUrl,
  });
}

function buildAppUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io').replace(/\/+$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
}

function formatMoney(amountCents: number, currency: string): string {
  const dollars = amountCents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(dollars);
  } catch {
    return `${currency} ${dollars.toFixed(2)}`;
  }
}
