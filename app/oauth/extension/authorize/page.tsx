// app/oauth/extension/authorize/page.tsx
//
// OAuth-style consent screen opened by the Chrome extension via
// chrome.identity.launchWebAuthFlow. Requires an existing Supabase session;
// on Approve, swaps the session for a one-time code and redirects back to
// the extension's chromiumapp.org redirect URI with the code in the fragment.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// Only allow redirects back to the Chrome extension's own identity URL.
// Anything else would be an open-redirect vector for the code.
function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === 'https:' && u.hostname.endsWith('.chromiumapp.org');
  } catch {
    return false;
  }
}

function AuthorizeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, teamMember, loading: authLoading } = useAuth();

  const redirectUri = params.get('redirect_uri') || '';
  const state = params.get('state') || '';

  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  // Redirect to login preserving the current URL so the user comes back here.
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      const back = encodeURIComponent(
        `/oauth/extension/authorize?${params.toString()}`
      );
      router.replace(`/login?next=${back}`);
    }
  }, [session, authLoading, router, params]);

  if (authLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal">
        <Loader2 size={24} className="animate-spin text-white/70" />
      </div>
    );
  }

  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-ink mb-2">Invalid request</h2>
          <p className="text-muted text-sm">
            This authorization link is missing or has an invalid redirect URL.
          </p>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setError('');
    setApproving(true);
    try {
      const { data: { session: fresh } } = await supabase.auth.getSession();
      const accessToken = fresh?.access_token;
      if (!accessToken) throw new Error('No active session');

      const res = await fetch('/api/oauth/extension/authorize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: 'Chrome Extension' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Authorization failed');

      const url = new URL(redirectUri);
      const fragment = new URLSearchParams({ code: json.code });
      if (state) fragment.set('state', state);
      url.hash = fragment.toString();
      window.location.href = url.toString();
    } catch (e: any) {
      setError(e.message || 'Authorization failed');
      setApproving(false);
    }
  };

  const handleDeny = () => {
    const url = new URL(redirectUri);
    const fragment = new URLSearchParams({ error: 'access_denied' });
    if (state) fragment.set('state', state);
    url.hash = fragment.toString();
    window.location.href = url.toString();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-8 mx-auto mb-6" />
          <div className="w-14 h-14 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="text-teal" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-ink">Allow extension access?</h1>
          <p className="text-sm text-faint mt-2">
            The <strong className="text-ink">Agency Viz Chrome extension</strong> is
            requesting permission to save ads into your Swipe File on behalf of:
          </p>
          <p className="text-sm text-ink font-medium mt-3">
            {teamMember?.name || session.user.email}
          </p>
          {teamMember?.name && (
            <p className="text-xs text-faint">{session.user.email}</p>
          )}
        </div>

        <div className="bg-surface rounded-lg p-4 mb-6 text-xs text-muted space-y-1.5">
          <p>This will allow the extension to:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Read your Swipe File types</li>
            <li>Import ads into your Swipe File</li>
          </ul>
          <p className="pt-2">
            You can revoke access at any time from Settings → API Keys.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleDeny}
            disabled={approving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-edge text-muted hover:border-edge-hover disabled:opacity-50"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex-1 flex items-center justify-center gap-2 bg-teal text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-hover disabled:opacity-50"
          >
            {approving && <Loader2 size={16} className="animate-spin" />}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-teal">
          <Loader2 size={24} className="animate-spin text-white/70" />
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}
