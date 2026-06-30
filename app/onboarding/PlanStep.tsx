'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Loader2,
  CreditCard,
  Check,
  ArrowRight,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/Button';
import { type PlanShape, formatMoney } from './onboarding-types';

export function PlanStep({ companyId, onSkip }: { companyId: string; onSkip: () => void }) {
  const [plan, setPlan] = useState<PlanShape | null>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/billing/subscription?company_id=${companyId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setPlan(json.plan);
        if (json.subscription?.status === 'active' || json.subscription?.status === 'trialing') {
          setAlreadyActive(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const startCheckout = async () => {
    setError(null);
    setRedirecting(true);
    try {
      const res = await authFetch(`/api/billing/checkout?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing_cycle: cycle }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || 'Failed to start checkout');
        setRedirecting(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Network error');
      setRedirecting(false);
    }
  };

  const monthlyLabel = useMemo(
    () => (plan ? formatMoney(plan.monthly_price_cents) : ''),
    [plan],
  );
  const yearlyLabel = useMemo(
    () => (plan ? formatMoney(plan.yearly_price_cents) : ''),
    [plan],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-teal-tint rounded-2xl flex items-center justify-center">
          <Sparkles size={20} className="text-teal" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">Start your 7-day trial</h2>
          <p className="text-xs text-muted">
            Card required. We won&apos;t charge you until the trial ends — cancel any time.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 size={20} className="animate-spin text-faint" />
        </div>
      ) : alreadyActive ? (
        <div className="border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm rounded-lg p-4 flex items-center gap-3">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium">You&apos;re all set!</p>
            <p className="text-xs text-emerald-700 mt-0.5">Your workspace already has an active subscription.</p>
          </div>
        </div>
      ) : !plan ? (
        <div className="border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-lg p-3">
          No plan is configured yet. Contact support.
        </div>
      ) : (
        <>
          <div className="border border-edge rounded-2xl p-4 bg-surface">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-faint font-semibold">
                  {plan.name}
                </div>
                <div className="text-2xl font-semibold text-ink mt-1">
                  {cycle === 'monthly' ? monthlyLabel : yearlyLabel}
                  <span className="text-sm font-normal text-muted ml-1">
                    / {cycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
              </div>
              <span className="text-2xs uppercase tracking-wide text-teal bg-teal/10 px-2 py-0.5 rounded-full font-semibold">
                7-day trial
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <CycleOption
              active={cycle === 'monthly'}
              label="Monthly"
              sub={`${monthlyLabel} / mo`}
              onClick={() => setCycle('monthly')}
            />
            <CycleOption
              active={cycle === 'yearly'}
              label="Yearly"
              sub={`${yearlyLabel} / yr`}
              badge="Save 2 months"
              onClick={() => setCycle('yearly')}
            />
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="pt-2 space-y-2">
        {alreadyActive ? (
          <Button fullWidth onClick={onSkip} rightIcon={ArrowRight}>
            Continue
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              loading={redirecting}
              onClick={startCheckout}
              leftIcon={CreditCard}
              disabled={!plan}
            >
              Start 7-day free trial
            </Button>
            <button
              type="button"
              onClick={onSkip}
              className="w-full text-xs text-faint hover:text-ink"
            >
              I&apos;ll set up billing later
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Billing cycle toggle (used only by PlanStep) ───────────────────── */

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
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border px-3 py-3 transition-colors ${
        active ? 'border-teal bg-teal/5' : 'border-edge hover:border-edge-hover bg-white'
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
