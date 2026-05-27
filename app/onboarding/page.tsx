// app/onboarding/page.tsx
// Self-serve onboarding wizard. Reached by AuthGuard whenever an agency-
// type company has companies.onboarding_completed_at == null. Walks the
// new owner through branding → invites → plan → done, then flips the
// completion flag and drops them into the dashboard.

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Loader2,
  Sparkles,
  Users,
  CreditCard,
  Check,
  Upload,
  ArrowRight,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authFetch } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/Button';
import { useAnalytics } from '@/hooks/useAnalytics';

type Step = 'agency' | 'invite' | 'plan' | 'done';
const STEPS: Step[] = ['agency', 'invite', 'plan', 'done'];

type CompanyShape = {
  id: string;
  name: string;
  slug: string;
  accent_color: string | null;
  logo_path: string | null;
  logo_url: string | null;
  onboarding_completed_at: string | null;
};

type PlanShape = {
  name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
};

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { track } = useAnalytics();

  const requestedStep = (searchParams.get('step') as Step) || 'agency';
  const step: Step = STEPS.includes(requestedStep) ? requestedStep : 'agency';

  const [company, setCompany] = useState<CompanyShape | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [gateChecked, setGateChecked] = useState(false);

  /* ── Auth + completion gate ──────────────────────────────────────── */

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) {
      router.replace('/login');
      return;
    }
    if (!auth.teamMember || !auth.companyId) return; // useAuth still loading
    // Clients don't onboard — they're sub-accounts created by an agency.
    if (auth.accountType === 'client') {
      router.replace('/');
      return;
    }
    setGateChecked(true);
  }, [auth.loading, auth.session, auth.teamMember, auth.companyId, auth.accountType, router]);

  /* ── Load active company ─────────────────────────────────────────── */

  const loadCompany = useCallback(async () => {
    if (!auth.companyId) return;
    setCompanyLoading(true);
    try {
      const res = await authFetch(`/api/company?company_id=${auth.companyId}`);
      if (!res.ok) return;
      const data = (await res.json()) as CompanyShape;
      setCompany(data);

      // Already finished: jump them out. Covers refreshes after step=done.
      if (data.onboarding_completed_at && step !== 'done') {
        router.replace('/');
      }
    } finally {
      setCompanyLoading(false);
    }
  }, [auth.companyId, step, router]);

  useEffect(() => {
    if (gateChecked) loadCompany();
  }, [gateChecked, loadCompany]);

  /* ── Auto-complete from Stripe success redirect ──────────────────── */

  useEffect(() => {
    if (step !== 'done' || !gateChecked || !company) return;
    if (company.onboarding_completed_at) {
      router.replace('/');
      return;
    }
    (async () => {
      await authFetch(`/api/onboarding/complete?company_id=${auth.companyId}`, {
        method: 'POST',
      });
      // The success_url of /api/billing/checkout lands here on Stripe success.
      // Trial_started fires here even if the user used "I'll set up billing
      // later" — in that case it just means "finished onboarding without a
      // sub", which a downstream funnel filter can split on.
      track('signup_completed', { has_stripe: Boolean(searchParams.get('session_id')) });
      if (searchParams.get('session_id')) {
        track('trial_started');
      }
      // Re-fetch memberships so other surfaces pick up the new state.
      if (auth.session?.user) await auth.refreshMemberships(auth.session.user.id);
      router.replace('/');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gateChecked, company]);

  const goTo = (next: Step) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('step', next);
    router.replace(`/onboarding?${p.toString()}`);
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  if (auth.loading || !gateChecked || companyLoading || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-8 mx-auto mb-6" />
          <h1 className="text-2xl font-semibold text-white">Set up your workspace</h1>
          <p className="text-sm text-white/70 mt-1">A few quick steps and you&apos;re in.</p>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white rounded-2xl shadow-xl p-8 mt-6">
          {step === 'agency' && (
            <AgencyStep
              company={company}
              onSaved={(updated) => {
                setCompany(updated);
                goTo('invite');
              }}
            />
          )}
          {step === 'invite' && (
            <InviteStep
              companyId={company.id}
              onNext={() => goTo('plan')}
            />
          )}
          {step === 'plan' && (
            <PlanStep
              companyId={company.id}
              onSkip={() => goTo('done')}
            />
          )}
          {step === 'done' && (
            <div className="text-center py-6">
              <Loader2 size={22} className="animate-spin text-teal mx-auto mb-3" />
              <p className="text-sm text-muted">Finishing setup…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step indicator ──────────────────────────────────────────────────── */

function StepIndicator({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    agency: 'Branding',
    invite: 'Invite',
    plan: 'Plan',
    done: 'Done',
  };
  const currentIdx = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      {STEPS.map((s, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                isPast
                  ? 'bg-white text-teal'
                  : isCurrent
                    ? 'bg-white text-teal ring-2 ring-white/40'
                    : 'bg-white/15 text-white/60'
              }`}
            >
              {isPast ? <Check size={14} /> : idx + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                isCurrent ? 'text-white' : 'text-white/60'
              }`}
            >
              {labels[s]}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-white/15 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: agency name + branding ──────────────────────────────────── */

function AgencyStep({
  company,
  onSaved,
}: {
  company: CompanyShape;
  onSaved: (updated: CompanyShape) => void;
}) {
  const [name, setName] = useState(company.name);
  const [accent, setAccent] = useState<string>(company.accent_color || '#017C87');
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadLogo = async (file: File) => {
    setError(null);
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await authFetch(`/api/company/logo?company_id=${company.id}`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Logo upload failed');
        return;
      }
      setLogoPreview(json.logo_url || null);
    } catch {
      setError('Network error uploading logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Agency name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/company?company_id=${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          accent_color: accent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save');
        setSaving(false);
        return;
      }
      onSaved({ ...company, name: name.trim(), accent_color: accent });
    } catch {
      setError('Network error');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleContinue} className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-teal-tint rounded-xl flex items-center justify-center">
          <Building2 size={20} className="text-teal" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">Your agency</h2>
          <p className="text-xs text-muted">Name, logo, and brand color. You can change these later.</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">Agency name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">Logo</label>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg border border-dashed border-edge bg-surface flex items-center justify-center overflow-hidden">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <Upload size={18} className="text-faint" />
            )}
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-edge text-sm text-ink hover:bg-surface cursor-pointer">
            {uploadingLogo ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            <span>{logoPreview ? 'Replace' : 'Upload'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
              }}
            />
          </label>
          <span className="text-2xs text-faint">PNG, JPEG, SVG, or WebP. Max 2 MB.</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">Accent color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="w-12 h-10 rounded-lg border border-edge cursor-pointer bg-white p-1"
          />
          <input
            type="text"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            pattern="^#[0-9a-fA-F]{6}$"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="pt-2">
        <Button type="submit" fullWidth loading={saving} rightIcon={ArrowRight}>
          Continue
        </Button>
      </div>
    </form>
  );
}

/* ── Step 2: invite teammates ────────────────────────────────────────── */

type DraftInvite = { email: string; role: 'admin' | 'member' };

function InviteStep({ companyId, onNext }: { companyId: string; onNext: () => void }) {
  const [drafts, setDrafts] = useState<DraftInvite[]>([{ email: '', role: 'member' }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<DraftInvite>) => {
    setDrafts((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addRow = () => setDrafts((d) => [...d, { email: '', role: 'member' }]);
  const removeRow = (idx: number) => setDrafts((d) => d.filter((_, i) => i !== idx));

  const sendInvites = async () => {
    setError(null);
    const filled = drafts.filter((d) => d.email.trim().length > 0);
    if (filled.length === 0) {
      onNext();
      return;
    }
    setSending(true);
    try {
      for (const row of filled) {
        const res = await authFetch(`/api/invites?company_id=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: row.email.trim(), role: row.role }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(`Failed to invite ${row.email}: ${json.error || 'unknown error'}`);
          setSending(false);
          return;
        }
      }
      onNext();
    } catch {
      setError('Network error sending invites');
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-teal-tint rounded-xl flex items-center justify-center">
          <Users size={20} className="text-teal" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">Invite your team</h2>
          <p className="text-xs text-muted">Optional. You can invite more people later.</p>
        </div>
      </div>

      <div className="space-y-2">
        {drafts.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="email"
              placeholder="teammate@youragency.com"
              value={row.email}
              onChange={(e) => update(idx, { email: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
            <select
              value={row.role}
              onChange={(e) => update(idx, { role: e.target.value as DraftInvite['role'] })}
              className="px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              disabled={drafts.length === 1}
              className="text-faint hover:text-ink disabled:opacity-30 p-2"
              aria-label="Remove"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="text-xs text-teal hover:underline inline-flex items-center gap-1"
        >
          <Plus size={12} /> Add another
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="pt-2 flex gap-3">
        <Button variant="ghost" onClick={onNext} disabled={sending}>
          Skip for now
        </Button>
        <Button onClick={sendInvites} loading={sending} rightIcon={ArrowRight} fullWidth>
          {drafts.some((d) => d.email.trim()) ? 'Send & continue' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

/* ── Step 3: plan + checkout ─────────────────────────────────────────── */

function PlanStep({ companyId, onSkip }: { companyId: string; onSkip: () => void }) {
  const [plan, setPlan] = useState<PlanShape | null>(null);
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
        <div className="w-10 h-10 bg-teal-tint rounded-xl flex items-center justify-center">
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
      ) : !plan ? (
        <div className="border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-lg p-3">
          No plan is configured yet. Contact support.
        </div>
      ) : (
        <>
          <div className="border border-edge rounded-xl p-4 bg-surface">
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

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-white/70" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
