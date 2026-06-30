// app/onboarding/page.tsx
// Self-serve onboarding wizard. Reached by AuthGuard whenever an agency-
// type company has companies.onboarding_completed_at == null. Walks the
// new owner through branding → invites → plan → done, then flips the
// completion flag and drops them into the dashboard.

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authFetch } from '@/lib/auth-fetch';
import { useAnalytics } from '@/hooks/useAnalytics';
import { type Step, type CompanyShape, STEPS } from './onboarding-types';
import { StepIndicator } from './StepIndicator';
import { AgencyStep } from './AgencyStep';
import { InviteStep } from './InviteStep';
import { PlanStep } from './PlanStep';

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
