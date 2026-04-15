// components/auth/AuthGuard.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.session) {
      router.replace('/login');
    }
  }, [auth.loading, auth.session, router]);

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-teal animate-spin" />
      </div>
    );
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

  return <>{children(auth)}</>;
}