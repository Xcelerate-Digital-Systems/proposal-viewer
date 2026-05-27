// components/admin/settings/BillingTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Loader2, Sparkles, RefreshCcw, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import { useAnalytics } from '@/hooks/useAnalytics';

type SubscriptionResponse = {
  subscription: {
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
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | null;
  plan: {
    id: string;
    slug: string;
    name: string;
    monthly_price_cents: number;
    yearly_price_cents: number;
    features: Record<string, unknown>;
  } | null;
  trial_days_remaining: number | null;
};

interface BillingTabProps {
  companyId: string;
  role: 'owner' | 'admin' | 'member';
}

export default function BillingTab({ companyId, role }: BillingTabProps) {
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [actioning, setActioning] = useState<'checkout' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/billing/subscription?company_id=${companyId}`);
      const json = (await res.json()) as SubscriptionResponse | { error: string };
      if (!res.ok) {
        setError('error' in json ? json.error : 'Failed to load billing details');
        return;
      }
      setData(json as SubscriptionResponse);
      const existing = (json as SubscriptionResponse).subscription?.billing_cycle;
      if (existing === 'monthly' || existing === 'yearly') setCycle(existing);
    } catch {
      setError('Network error loading billing details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Fetch company name for the delete-confirm phrase. Cheap; only owners
  // see the Danger Zone but we fetch unconditionally so the modal can
  // mount instantly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/company?company_id=${companyId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCompanyName(json?.name ?? '');
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const startCheckout = async () => {
    setActioning('checkout');
    setError(null);
    try {
      const res = await authFetch(`/api/billing/checkout?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing_cycle: cycle }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || 'Failed to start checkout');
        setActioning(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Network error starting checkout');
      setActioning(null);
    }
  };

  const openPortal = async () => {
    setActioning('portal');
    setError(null);
    try {
      const res = await authFetch(`/api/billing/portal?company_id=${companyId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || 'Failed to open billing portal');
        setActioning(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Network error opening portal');
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl border border-edge rounded-2xl p-10 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-faint" />
      </div>
    );
  }

  const sub = data?.subscription;
  const plan = data?.plan;
  const hasActiveBillingRelationship =
    !!sub?.stripe_customer_id && sub.status !== 'incomplete';

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Plan card */}
      <div className="border border-edge rounded-2xl p-6 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-teal" />
              <span className="text-xs uppercase tracking-wide text-faint font-semibold">
                Current plan
              </span>
            </div>
            <div className="text-lg font-semibold text-ink">
              {plan?.name ?? 'No plan'}
            </div>
            {plan && (
              <div className="text-sm text-muted mt-1">
                {formatMoney(plan.monthly_price_cents)} / month
                {' · '}
                {formatMoney(plan.yearly_price_cents)} / year
              </div>
            )}
          </div>
          <StatusBadge status={sub?.status ?? 'incomplete'} />
        </div>

        {sub?.status === 'trialing' && data?.trial_days_remaining !== null && (
          <div className="mt-4 bg-teal/5 border border-teal/20 rounded-lg p-3 text-sm text-ink">
            {data?.trial_days_remaining === 0
              ? 'Your trial ends today.'
              : `${data?.trial_days_remaining} day${data?.trial_days_remaining === 1 ? '' : 's'} left in your trial.`}
            {sub?.trial_ends_at && (
              <span className="text-muted ml-1">
                Auto-renews on {formatDate(sub.trial_ends_at)}.
              </span>
            )}
          </div>
        )}

        {sub?.cancel_at_period_end && sub.current_period_end && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            Subscription is set to cancel on {formatDate(sub.current_period_end)}.
          </div>
        )}
      </div>

      {/* Action card */}
      {!hasActiveBillingRelationship ? (
        <div className="border border-edge rounded-2xl p-6 bg-white">
          <h3 className="text-sm font-semibold text-ink mb-1">Start your subscription</h3>
          <p className="text-xs text-faint mb-4">
            Card is required to start the 7-day trial. You won&apos;t be charged until day 7
            and can cancel any time.
          </p>

          <div className="flex gap-2 mb-4">
            <CycleOption
              active={cycle === 'monthly'}
              label="Monthly"
              sub={plan ? `${formatMoney(plan.monthly_price_cents)} / mo` : ''}
              onClick={() => setCycle('monthly')}
            />
            <CycleOption
              active={cycle === 'yearly'}
              label="Yearly"
              sub={plan ? `${formatMoney(plan.yearly_price_cents)} / yr` : ''}
              badge="Save 2 months"
              onClick={() => setCycle('yearly')}
            />
          </div>

          <Button
            fullWidth
            loading={actioning === 'checkout'}
            onClick={startCheckout}
            leftIcon={CreditCard}
          >
            Start 7-day free trial
          </Button>
        </div>
      ) : (
        <div className="border border-edge rounded-2xl p-6 bg-white">
          <h3 className="text-sm font-semibold text-ink mb-1">Manage subscription</h3>
          <p className="text-xs text-faint mb-4">
            Update your card, switch monthly ↔ yearly, view invoices, or cancel — all
            in your Stripe billing portal.
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              loading={actioning === 'portal'}
              onClick={openPortal}
              leftIcon={CreditCard}
            >
              Manage subscription
            </Button>
            <Button variant="ghost" leftIcon={RefreshCcw} onClick={load}>
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Danger Zone — owner only. Admins can manage the subscription but
          deleting the workspace is reserved for the owner. */}
      {role === 'owner' && (
        <div className="border border-red-200 rounded-2xl p-6 bg-white">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink mb-1">Delete this workspace</h3>
              <p className="text-xs text-faint mb-4">
                Permanently delete the workspace, cancel the subscription, and remove
                access for every teammate. This can&apos;t be undone after the 30-day
                recovery window.
              </p>
              <Button
                variant="danger"
                leftIcon={Trash2}
                onClick={() => setDeleteOpen(true)}
              >
                Delete workspace
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <DeleteWorkspaceModal
          companyId={companyId}
          companyName={companyName}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}

function DeleteWorkspaceModal({
  companyId,
  companyName,
  onClose,
}: {
  companyId: string;
  companyName: string;
  onClose: () => void;
}) {
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { track } = useAnalytics();
  const expected = `DELETE ${companyName}`;
  const phraseMatches = phrase === expected;

  const submit = async () => {
    if (!phraseMatches) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/company?company_id=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_phrase: phrase }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to delete workspace');
        setSubmitting(false);
        return;
      }
      track('workspace_deleted');
      // Force a full reload so AuthGuard re-runs and lands on the
      // "Workspace deleted" screen → sign out → /login.
      window.location.href = '/login';
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">Delete workspace?</h3>
            <p className="text-xs text-muted mt-1">
              This will cancel your Stripe subscription and remove access for every
              teammate. Your data is retained for 30 days for accidental-recovery.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-ink mb-1.5">
            Type <code className="px-1 py-0.5 bg-surface rounded text-red-600 font-mono">{expected}</code> to confirm:
          </label>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={expected}
            className="w-full px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!phraseMatches}
            loading={submitting}
            onClick={submit}
            leftIcon={Trash2}
          >
            Delete workspace
          </Button>
        </div>
      </div>
    </div>
  );
}

function CycleOption({
  active,
  label,
  sub,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  sub: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border px-3 py-3 transition-colors ${
        active
          ? 'border-teal bg-teal/5'
          : 'border-edge hover:border-edge-hover bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${active ? 'text-teal' : 'text-ink'}`}>
          {label}
        </span>
        {badge && (
          <span className="text-2xs uppercase tracking-wide text-teal bg-teal/10 px-2 py-0.5 rounded-full font-semibold">
            {badge}
          </span>
        )}
      </div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trialing: 'bg-teal/10 text-teal',
    active: 'bg-emerald-50 text-emerald-700',
    past_due: 'bg-amber-50 text-amber-700',
    canceled: 'bg-gray-100 text-gray-600',
    unpaid: 'bg-red-50 text-red-700',
    paused: 'bg-gray-100 text-gray-600',
    incomplete: 'bg-gray-100 text-gray-600',
  };
  const label: Record<string, string> = {
    trialing: 'Trial',
    active: 'Active',
    past_due: 'Past due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
    paused: 'Paused',
    incomplete: 'Not started',
  };
  return (
    <span
      className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
        styles[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
