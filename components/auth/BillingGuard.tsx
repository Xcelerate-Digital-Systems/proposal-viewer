// components/auth/BillingGuard.tsx
//
// Wraps the admin layout's main content and:
//   • Shows a thin top banner while the subscription is trialing
//     ("X days left in trial · Manage subscription").
//   • Renders a full-screen lockout for canceled / past_due / unpaid
//     subscriptions, with a "Manage billing" CTA for owners/admins or
//     a "Contact your workspace owner" message for everyone else.
//
// Grandfathered legacy companies (signup_source='invite', no subscription
// row) come back from /api/billing/entitlements as is_active=true and
// see neither the banner nor the lockout — exactly matching today's
// behaviour for existing customers.

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/Button';
import AppLoader from '@/components/ui/AppLoader';

interface BillingGuardProps {
  companyId: string;
  accountType: 'agency' | 'client';
  role: 'owner' | 'admin' | 'member';
  children: React.ReactNode;
}

type SubscriptionState = {
  is_active: boolean;
  is_grandfathered: boolean;
  inactive_reason:
    | 'no_subscription'
    | 'trial_expired'
    | 'subscription_canceled'
    | 'subscription_past_due'
    | 'subscription_unpaid'
    | null;
  subscription: {
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
};

// Paths a user can always reach even if billing is broken — billing
// portal, auth flows, marketing. Anything else is locked out.
const LOCKOUT_EXEMPT_PATHS = [
  '/settings',
  '/onboarding',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/home',
  '/pricing',
  '/privacy-policy',
  '/terms-and-conditions',
];

function isPathExempt(pathname: string): boolean {
  return LOCKOUT_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function BillingGuard({ companyId, accountType, role, children }: BillingGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Clients don't have their own billing — they belong to an agency. Skip.
    if (accountType === 'client') {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const FAIL_OPEN: SubscriptionState = { is_active: true, is_grandfathered: false, inactive_reason: null, subscription: null };
    const fetchState = async (attempt: number): Promise<void> => {
      try {
        const res = await authFetch(`/api/billing/entitlements?company_id=${companyId}`);
        if (!res.ok) {
          if (attempt === 0) return fetchState(1);
          console.error('BillingGuard: entitlements check failed after retry, failing open');
          if (!cancelled) { setState(FAIL_OPEN); setLoaded(true); }
          return;
        }
        const json = (await res.json()) as SubscriptionState;
        if (!cancelled) { setState(json); setLoaded(true); }
      } catch {
        if (attempt === 0) return fetchState(1);
        console.error('BillingGuard: entitlements check failed after retry, failing open');
        if (!cancelled) { setState(FAIL_OPEN); setLoaded(true); }
      }
    };
    fetchState(0);
    return () => {
      cancelled = true;
    };
  }, [companyId, accountType]);

  // Hold the screen blank while we resolve the subscription state. Without
  // this a self-serve customer would see the dashboard for a frame before
  // the lockout kicks in, which is jarring.
  if (!loaded) {
    return <AppLoader />;
  }

  // Clients (and any case where state somehow resolved to null) — render
  // children unchanged, no banner.
  if (!state || accountType === 'client') {
    return <>{children}</>;
  }

  const isLockedOut = !state.is_active;
  const isAdminOrOwner = role === 'owner' || role === 'admin';

  // Inactive subscription + not on a billing-related page → lockout overlay.
  // The blurred dashboard behind creates urgency to resubscribe.
  if (isLockedOut && !isPathExempt(pathname)) {
    return (
      <>
        <div className="h-dvh overflow-hidden pointer-events-none select-none">
          <div className="blur-sm opacity-40">{children}</div>
        </div>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="text-amber-500" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-ink mb-2">
              {titleForInactive(state.inactive_reason)}
            </h2>
            <p className="text-muted text-sm mb-6">
              {bodyForInactive(state.inactive_reason, isAdminOrOwner)}
            </p>
            {isAdminOrOwner ? (
              <Button
                onClick={() => router.push('/settings?tab=billing')}
                leftIcon={CreditCard}
              >
                Open billing settings
              </Button>
            ) : (
              <p className="text-xs text-faint">
                Ask the workspace owner to update billing from Settings → Billing.
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  // Trialing → render the children with a thin countdown banner above.
  const trialDaysRemaining = trialDaysFromIso(state.subscription?.trial_ends_at);
  const showTrialBanner =
    state.subscription?.status === 'trialing' && trialDaysRemaining !== null;

  return (
    <div className="flex flex-col h-dvh">
      {showTrialBanner && (
        <TrialBanner
          daysRemaining={trialDaysRemaining as number}
          onManage={() => router.push('/settings?tab=billing')}
        />
      )}
      <div className={showTrialBanner ? 'flex-1 min-h-0' : 'h-full'}>{children}</div>
    </div>
  );
}

function TrialBanner({
  daysRemaining,
  onManage,
}: {
  daysRemaining: number;
  onManage: () => void;
}) {
  const label =
    daysRemaining === 0
      ? 'Your trial ends today.'
      : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your trial.`;
  return (
    <div className="bg-teal text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-3 shrink-0">
      <span>{label}</span>
      <button
        onClick={onManage}
        className="underline underline-offset-2 hover:text-white/90"
      >
        Manage subscription
      </button>
    </div>
  );
}

function titleForInactive(reason: SubscriptionState['inactive_reason']): string {
  switch (reason) {
    case 'subscription_canceled':
      return 'Subscription canceled';
    case 'subscription_past_due':
    case 'subscription_unpaid':
      return 'Payment failed';
    case 'trial_expired':
      return 'Your trial has ended';
    case 'no_subscription':
    case null:
    default:
      return 'No active subscription';
  }
}

function bodyForInactive(
  reason: SubscriptionState['inactive_reason'],
  isAdminOrOwner: boolean,
): string {
  if (!isAdminOrOwner) {
    return 'Your workspace owner needs to update billing before you can keep working.';
  }
  switch (reason) {
    case 'subscription_canceled':
      return 'Your AgencyViz subscription has been canceled. Re-activate it to keep using your workspace.';
    case 'subscription_past_due':
    case 'subscription_unpaid':
      return "We weren't able to charge your card. Update your payment method to keep working.";
    case 'trial_expired':
      return 'Add a payment method to continue. Your data is safe and waiting.';
    case 'no_subscription':
    case null:
    default:
      return 'Your workspace doesn’t have an active subscription. Start your 7-day trial to keep using AgencyViz.';
  }
}

function trialDaysFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
