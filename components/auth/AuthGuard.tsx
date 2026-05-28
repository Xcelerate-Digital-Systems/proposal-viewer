// components/auth/AuthGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import AppLoader from '@/components/ui/AppLoader';

interface AuthGuardProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Onboarding gate state. `null` until we've fetched companies.onboarding_completed_at
  // for the active company; then either an ISO timestamp (complete) or '' (incomplete).
  // Tracked separately from auth so a redirect doesn't flash the dashboard.
  const [onboardingState, setOnboardingState] = useState<string | null | undefined>(undefined);
  // Soft-delete: companies.deleted_at. When set we render a "workspace
  // deleted" screen instead of letting the user continue into a tombstone.
  const [companyDeleted, setCompanyDeleted] = useState<boolean>(false);

  useEffect(() => {
    if (!auth.loading && !auth.session) {
      router.replace('/login');
    }
  }, [auth.loading, auth.session, router]);

  // Fetch the active company's onboarding_completed_at. Skip for clients (they
  // never onboard) and when the user is overriding into another company.
  useEffect(() => {
    if (!auth.session || !auth.teamMember || !auth.companyId) return;
    if (auth.accountType === 'client') {
      setOnboardingState(''); // treat as complete — clients never see /onboarding
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('onboarding_completed_at, deleted_at')
        .eq('id', auth.companyId)
        .maybeSingle();
      if (cancelled) return;
      setOnboardingState(
        (data?.onboarding_completed_at as string | null) ?? null,
      );
      setCompanyDeleted(Boolean(data?.deleted_at));
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.session, auth.teamMember, auth.companyId, auth.accountType]);

  // Redirect agencies with incomplete onboarding to the wizard.
  useEffect(() => {
    if (onboardingState !== null) return;
    if (pathname.startsWith('/onboarding')) return;
    router.replace('/onboarding');
  }, [onboardingState, pathname, router]);

  if (auth.loading) {
    return <AppLoader />;
  }

  if (!auth.session) return null;

  // User is signed in to Supabase but has no team_members row and no pending
  // invite to auto-claim. Show a clear message instead of letting them hit
  // silent 401s on every page action.
  if (!auth.teamMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="text-amber-500" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No team membership</h2>
          <p className="text-muted text-sm mb-6">
            Your account isn&apos;t linked to a team. Ask an owner to send a fresh invite to{' '}
            <strong className="text-ink">{auth.session.user.email}</strong>, then click the link in
            the email to join.
          </p>
          <button
            onClick={async () => {
              await auth.signOut();
              router.replace('/login');
            }}
            className="inline-flex items-center justify-center gap-2 bg-teal text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-hover transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Hold the screen blank while we resolve onboarding state and (potentially)
  // redirect. Without this we'd briefly render the dashboard before the
  // useEffect above kicks the user out — which is jarring on a slow network.
  if (onboardingState === undefined) {
    return <AppLoader />;
  }

  // Workspace was deleted by its owner. Block access; sign-out forces a
  // re-login which, via useAuth's filter, won't pick this membership again.
  if (companyDeleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="text-amber-500" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Workspace deleted</h2>
          <p className="text-muted text-sm mb-6">
            This workspace has been permanently deleted by its owner. If you have
            another workspace, sign out and back in to switch to it.
          </p>
          <button
            onClick={async () => {
              await auth.signOut();
              router.replace('/login');
            }}
            className="inline-flex items-center justify-center gap-2 bg-teal text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-hover transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (onboardingState === null && !pathname.startsWith('/onboarding')) {
    return <AppLoader />;
  }

  return <>{children(auth)}</>;
}
