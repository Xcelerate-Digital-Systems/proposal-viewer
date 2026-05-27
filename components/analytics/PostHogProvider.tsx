// components/analytics/PostHogProvider.tsx
//
// Optional product analytics. Initialises posthog-js once on mount if
// NEXT_PUBLIC_POSTHOG_KEY is set; otherwise renders a transparent
// pass-through so the app works identically with analytics off.
//
// Sister hook: hooks/useAnalytics — gives any client component a
// no-op-safe `track(event, props)`.

'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialised = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(POSTHOG_KEY);
}

function initPostHogOnce() {
  if (initialised || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Manual pageview tracking so we can include the resolved path on
    // App Router transitions (which don't fire a full page load).
    capture_pageview: false,
    // Don't send Personal Identifiable Information until identify() runs.
    person_profiles: 'identified_only',
    // Keep autocapture off — too noisy for a B2B SaaS, and we want
    // explicit funnel events not random button-click intel.
    autocapture: false,
    // Disable session recording by default; flip this on in PostHog when
    // you're ready to invest in support replays.
    disable_session_recording: true,
  });
  initialised = true;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHogOnce();
  }, []);

  // Pageview on path or query-string change. Skip on the very first
  // mount until posthog is initialised; the second render covers it.
  useEffect(() => {
    if (!isAnalyticsEnabled() || !initialised) return;
    const search = searchParams.toString();
    posthog.capture('$pageview', {
      $current_url: `${window.location.origin}${pathname}${search ? `?${search}` : ''}`,
    });
  }, [pathname, searchParams]);

  return <>{children}</>;
}

/* ── Imperative helpers for places where the hook isn't ergonomic ──── */

export function identifyAnalyticsUser(args: {
  userId: string;
  email?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  role?: string;
  accountType?: 'agency' | 'client';
  signupSource?: string;
}) {
  if (!isAnalyticsEnabled() || !initialised) return;
  posthog.identify(args.userId, {
    email: args.email,
    name: args.name,
    role: args.role,
    account_type: args.accountType,
    signup_source: args.signupSource,
  });
  if (args.companyId) {
    posthog.group('company', args.companyId, {
      name: args.companyName,
    });
  }
}

export function resetAnalyticsUser() {
  if (!isAnalyticsEnabled() || !initialised) return;
  posthog.reset();
}
