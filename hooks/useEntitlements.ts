// hooks/useEntitlements.ts
//
// Client-side mirror of /api/billing/entitlements. Returns the current
// company's plan limits + usage and a check(resource) helper that the UI
// uses to soft-stop create buttons (disabled + upgrade tooltip) before
// the server returns 402. Server is still the authority — this is UX only.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';

type Resource = 'proposals' | 'documents' | 'reviews' | 'seats' | 'meta_connections';

type Limits = {
  seats: number | null;
  proposals: number | null;
  documents: number | null;
  reviews: number | null;
  metaConnections: number | null;
  aiDaily: number;
};

type Usage = {
  seats: number;
  proposals: number;
  documents: number;
  reviews: number;
  metaConnections: number;
  aiToday: number;
};

type InactiveReason =
  | 'no_subscription'
  | 'trial_expired'
  | 'subscription_canceled'
  | 'subscription_past_due'
  | 'subscription_unpaid'
  | null;

type EntitlementsResponse = {
  is_active: boolean;
  is_grandfathered: boolean;
  inactive_reason: InactiveReason;
  plan: { id: string; slug: string; name: string } | null;
  subscription: {
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  limits: Limits;
  usage: Usage;
};

export type ResourceCheck = {
  allowed: boolean;
  used: number;
  limit: number | null;
  reason: 'ok' | 'inactive' | 'limit_reached';
  /** UI-ready message you can drop straight into a tooltip. Empty when allowed. */
  message: string;
};

const RESOURCE_LABEL: Record<Resource, string> = {
  proposals: 'proposals',
  documents: 'documents',
  reviews: 'review projects',
  seats: 'teammates',
  meta_connections: 'Meta connections',
};

export function useEntitlements(companyId: string | null | undefined) {
  const [data, setData] = useState<EntitlementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`/api/billing/entitlements?company_id=${companyId}`);
      if (!res.ok) {
        setError('Failed to load plan');
        return;
      }
      const json = (await res.json()) as EntitlementsResponse;
      setData(json);
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const check = useCallback(
    (resource: Resource): ResourceCheck => {
      if (!data) {
        // Fail open while loading — better to let the click through and let
        // the server 402 catch it than to block legitimate use during the
        // initial fetch.
        return { allowed: true, used: 0, limit: null, reason: 'ok', message: '' };
      }
      if (!data.is_active) {
        return {
          allowed: false,
          used: 0,
          limit: null,
          reason: 'inactive',
          message: inactiveMessage(data.inactive_reason),
        };
      }
      const limit = limitFor(data.limits, resource);
      const used = usageFor(data.usage, resource);
      if (limit === null) {
        return { allowed: true, used, limit: null, reason: 'ok', message: '' };
      }
      if (used >= limit) {
        return {
          allowed: false,
          used,
          limit,
          reason: 'limit_reached',
          message: `You've hit the ${limit}-${RESOURCE_LABEL[resource]} limit on your plan. Upgrade to add more.`,
        };
      }
      return { allowed: true, used, limit, reason: 'ok', message: '' };
    },
    [data],
  );

  return {
    loading,
    error,
    data,
    check,
    refresh,
  };
}

function limitFor(limits: Limits, resource: Resource): number | null {
  switch (resource) {
    case 'proposals':
      return limits.proposals;
    case 'documents':
      return limits.documents;
    case 'reviews':
      return limits.reviews;
    case 'seats':
      return limits.seats;
    case 'meta_connections':
      return limits.metaConnections;
  }
}

function usageFor(usage: Usage, resource: Resource): number {
  switch (resource) {
    case 'proposals':
      return usage.proposals;
    case 'documents':
      return usage.documents;
    case 'reviews':
      return usage.reviews;
    case 'seats':
      return usage.seats;
    case 'meta_connections':
      return usage.metaConnections;
  }
}

function inactiveMessage(reason: InactiveReason): string {
  switch (reason) {
    case 'subscription_canceled':
      return 'Your subscription is canceled. Re-activate it from Settings → Billing.';
    case 'subscription_past_due':
    case 'subscription_unpaid':
      return 'Your last payment failed. Update your card from Settings → Billing.';
    case 'no_subscription':
    case 'trial_expired':
    case null:
    default:
      return 'Start your trial from Settings → Billing to create more.';
  }
}
