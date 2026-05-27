// app/auth/callback/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const providerError = searchParams.get('error_description') || searchParams.get('error');

    if (providerError) {
      setError(providerError);
      return;
    }

    if (!code) {
      // Implicit-flow fallback: Supabase may have put the session in the URL
      // fragment instead. The client SDK picks that up automatically; wait a
      // tick for onAuthStateChange to settle then route based on session.
      const t = setTimeout(() => routeAfterAuth({ setError, router }), 500);
      return () => clearTimeout(t);
    }

    (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      await routeAfterAuth({ setError, router });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="text-amber-500" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Sign-in failed</h2>
          <p className="text-muted text-sm mb-6">{error}</p>
          <Button onClick={() => router.replace('/login')}>Back to sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal">
      <div className="text-center">
        <Loader2 size={24} className="animate-spin text-white/70 mx-auto mb-3" />
        <p className="text-sm text-white/70">Signing you in…</p>
      </div>
    </div>
  );
}

/**
 * After the OAuth handshake completes, route to:
 *   - /login?error=… if the session never materialised
 *   - the existing app (/) if the user already has a team_members row
 *   - /api/auth/register (self-serve branch) if they don't, then /onboarding
 *     on success — or back to /login with a friendly error if the public
 *     signup gate is closed for their email.
 */
async function routeAfterAuth({
  setError,
  router,
}: {
  setError: (e: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    setError('Sign-in did not complete. Please try again.');
    return;
  }

  const user = session.user;

  const { data: existingMembers } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (existingMembers && existingMembers.length > 0) {
    router.replace('/');
    return;
  }

  // No team_members row yet. Try the existing claim-invite self-heal first
  // (covers the case where the user was invited and signs in with Google
  // using the same email as the invite).
  const claimRes = await fetch('/api/auth/claim-invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (claimRes.ok) {
    const claim = await claimRes.json();
    if (claim.claimed) {
      router.replace('/');
      return;
    }
  }

  // No invite either — attempt self-serve registration. The server route
  // re-checks the public-signup gate against the verified email; if closed
  // we surface the same "invite required" copy and sign the user out so they
  // don't end up stuck in a half-authed state.
  const displayName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : user.email?.split('@')[0] || 'New user';

  const companyName = `${displayName.split(' ')[0] || displayName}'s Workspace`;

  const registerRes = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      name: displayName,
      company_name: companyName,
    }),
  });

  if (!registerRes.ok) {
    const body = await registerRes.json().catch(() => ({}));
    await supabase.auth.signOut();
    setError(body.error || 'Account could not be created.');
    return;
  }

  router.replace('/onboarding');
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-teal">
          <Loader2 size={24} className="animate-spin text-white/70" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
