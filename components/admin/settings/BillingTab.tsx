// components/admin/settings/BillingTab.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard, Loader2, Sparkles, RefreshCcw, Trash2, AlertTriangle,
  Check, FileText, DollarSign, FolderOpen, Bookmark, BarChart3, GitFork, MessageSquareMore,
  Calendar, Receipt, ArrowUpRight, Users, Zap, Palette,
} from 'lucide-react';
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

const PLAN_FEATURES = [
  { icon: FileText,           label: 'Proposals — branded, trackable client proposals' },
  { icon: DollarSign,         label: 'Quotes — interactive pricing with payment schedules' },
  { icon: FolderOpen,         label: 'Documents — rich-text pages with full design control' },
  { icon: Bookmark,           label: 'Swipe File — save and organise creative inspiration' },
  { icon: BarChart3,          label: 'Looker Studio Connector — live ad reporting dashboards' },
  { icon: GitFork,            label: 'Funnel Planner — map and visualise client funnels' },
  { icon: MessageSquareMore,  label: 'Creative Review — annotate, comment and approve assets' },
  { icon: Users,              label: 'Unlimited team members and client guests' },
  { icon: Zap,                label: 'AI-powered content generation' },
  { icon: Palette,            label: 'Custom branding, fonts and cover images' },
];

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
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-faint" />
      </div>
    );
  }

  const sub = data?.subscription;
  const plan = data?.plan;
  const hasActiveBillingRelationship =
    !!sub?.stripe_customer_id && sub.status !== 'incomplete';

  const monthlyPrice = plan ? formatMoney(plan.monthly_price_cents) : '$0';
  const yearlyPrice = plan ? formatMoney(plan.yearly_price_cents) : '$0';
  const yearlyMonthly = plan ? formatMoney(Math.round(plan.yearly_price_cents / 12)) : '$0';

  return (
    <div className="space-y-6">
      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-2xl p-3">
          {error}
        </div>
      )}

      {/* Hero plan card */}
      <div className="bg-white border border-edge rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-teal/5 via-white to-teal/3 px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-2xl bg-teal/10 flex items-center justify-center">
                  <Sparkles size={16} className="text-teal" />
                </div>
                <StatusBadge status={sub?.status ?? 'incomplete'} />
              </div>
              <h3 className="text-xl font-bold text-ink">{plan?.name ?? 'No plan'}</h3>
              {sub?.billing_cycle && (
                <p className="text-sm text-muted mt-0.5">
                  Billed {sub.billing_cycle === 'yearly' ? 'annually' : 'monthly'}
                </p>
              )}
            </div>
            {plan && (
              <div className="text-right">
                <div className="text-2xl font-bold text-ink">
                  {sub?.billing_cycle === 'yearly' ? yearlyMonthly : monthlyPrice}
                </div>
                <div className="text-xs text-muted">per month</div>
                {sub?.billing_cycle === 'yearly' && (
                  <div className="text-xs text-teal font-medium mt-0.5">
                    {yearlyPrice} billed annually
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trial alert */}
          {sub?.status === 'trialing' && data && data.trial_days_remaining !== null && (
            <div className="bg-teal/5 border border-teal/15 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                <Calendar size={16} className="text-teal" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">
                  {data.trial_days_remaining === 0
                    ? 'Your trial ends today'
                    : `${data.trial_days_remaining} day${data.trial_days_remaining === 1 ? '' : 's'} left in your trial`}
                </p>
                {sub.trial_ends_at && (
                  <p className="text-xs text-muted mt-0.5">
                    Your subscription will begin on {formatDate(sub.trial_ends_at)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cancellation notice */}
          {sub?.cancel_at_period_end && sub.current_period_end && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900">Subscription ending</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Access continues until {formatDate(sub.current_period_end)}. Reactivate to keep your workspace.
                </p>
              </div>
            </div>
          )}

          {/* Next billing / period info */}
          {hasActiveBillingRelationship && sub?.current_period_end && !sub.cancel_at_period_end && sub.status !== 'trialing' && (
            <div className="flex items-center gap-2 text-xs text-muted mt-3 pt-3 border-t border-edge">
              <Receipt size={13} className="text-faint" />
              Next billing date: <span className="text-ink font-medium">{formatDate(sub.current_period_end)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Checkout (no subscription) or Management (active sub) */}
      {!hasActiveBillingRelationship ? (
        <div className="bg-white border border-edge rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink mb-1">Start your subscription</h3>
          <p className="text-xs text-muted mb-5">
            Card is required to start the 7-day free trial. You won&apos;t be charged until day 7
            and can cancel any time.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <CycleOption
              active={cycle === 'monthly'}
              label="Monthly"
              price={monthlyPrice}
              sub="per month"
              onClick={() => setCycle('monthly')}
            />
            <CycleOption
              active={cycle === 'yearly'}
              label="Yearly"
              price={yearlyMonthly}
              sub="per month"
              badge="Save 17%"
              detail={`${yearlyPrice} billed annually`}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <button
            onClick={openPortal}
            disabled={actioning === 'portal'}
            className="bg-white border border-edge rounded-2xl p-5 text-left hover:border-teal/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-2xl bg-teal/10 flex items-center justify-center">
                <CreditCard size={16} className="text-teal" />
              </div>
              <ArrowUpRight size={14} className="text-faint group-hover:text-teal transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-ink mb-0.5">Manage subscription</h4>
            <p className="text-xs text-muted">
              Update card, switch plans, or cancel
            </p>
          </button>

          <button
            onClick={openPortal}
            disabled={actioning === 'portal'}
            className="bg-white border border-edge rounded-2xl p-5 text-left hover:border-teal/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-2xl bg-surface flex items-center justify-center">
                <Receipt size={16} className="text-muted" />
              </div>
              <ArrowUpRight size={14} className="text-faint group-hover:text-teal transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-ink mb-0.5">Invoices & receipts</h4>
            <p className="text-xs text-muted">
              Download past invoices and update billing info
            </p>
          </button>
        </div>
      )}

      {/* Plan features */}
      <div className="bg-white border border-edge rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-ink mb-1">What&apos;s included</h3>
        <p className="text-xs text-muted mb-4">Everything you need to run your agency.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAN_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-muted" />
                </div>
                <span className="text-sm text-ink">{f.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refresh row */}
      {hasActiveBillingRelationship && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" leftIcon={RefreshCcw} onClick={load}>
            Refresh billing data
          </Button>
        </div>
      )}

      {/* Danger Zone — owner only */}
      {role === 'owner' && (
        <div className="border border-red-200 rounded-2xl p-6 bg-white">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink mb-1">Danger zone</h3>
              <p className="text-xs text-muted mb-4">
                Permanently delete this workspace and cancel the subscription. All team
                members lose access. Data is retained for 30 days for recovery.
              </p>
              <Button
                variant="danger"
                size="sm"
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
  price,
  sub,
  badge,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  price: string;
  sub: string;
  badge?: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-2xl border-2 px-4 py-4 transition-all ${
        active
          ? 'border-teal bg-teal/5 shadow-sm'
          : 'border-edge hover:border-edge-hover bg-white'
      }`}
    >
      {badge && (
        <span className="absolute -top-2.5 right-3 text-2xs uppercase tracking-wide text-white bg-teal px-2 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          active ? 'border-teal' : 'border-edge'
        }`}>
          {active && <div className="w-2 h-2 rounded-full bg-teal" />}
        </div>
        <span className={`text-sm font-semibold ${active ? 'text-teal' : 'text-ink'}`}>
          {label}
        </span>
      </div>
      <div className="pl-6">
        <span className="text-xl font-bold text-ink">{price}</span>
        <span className="text-xs text-muted ml-1">{sub}</span>
        {detail && <div className="text-xs text-muted mt-0.5">{detail}</div>}
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trialing: 'bg-teal/10 text-teal',
    active: 'bg-emerald-50 text-emerald-700',
    past_due: 'bg-amber-50 text-amber-700',
    canceled: 'bg-gray-100 text-prose',
    unpaid: 'bg-red-50 text-red-700',
    paused: 'bg-gray-100 text-prose',
    incomplete: 'bg-gray-100 text-prose',
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
      className={`text-detail font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${
        styles[status] ?? 'bg-gray-100 text-prose'
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
