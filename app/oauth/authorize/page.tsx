// app/oauth/authorize/page.tsx
//
// Standard OAuth2 authorization endpoint (user-facing). Third-party clients
// (Looker Studio connector, Zapier, etc.) redirect the user's browser here
// with client_id/redirect_uri/state/scope. User must be signed in. On
// Approve, a POST to /api/oauth/approve mints a one-time code and we
// redirect to redirect_uri?code=xxx&state=xxx.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

interface ClientInfo {
  client_id: string;
  name: string;
  redirect_allowed: boolean;
}

function AuthorizeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, teamMember, loading: authLoading } = useAuth();

  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const state = params.get('state') || '';
  const scope = params.get('scope') || '';
  const responseType = params.get('response_type') || 'code';
  const codeChallenge = params.get('code_challenge') || '';
  const codeChallengeMethod = params.get('code_challenge_method') || '';

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [validating, setValidating] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  // Not signed in → bounce to login, come back with all query params intact.
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      const back = encodeURIComponent(`/oauth/authorize?${params.toString()}`);
      router.replace(`/login?next=${back}`);
    }
  }, [session, authLoading, router, params]);

  // Ask the server to validate client_id + redirect_uri before we show
  // a consent screen — otherwise an attacker could craft a believable
  // consent page with an arbitrary "name".
  useEffect(() => {
    if (!clientId || !redirectUri) {
      setValidating(false);
      return;
    }
    fetch(
      `/api/oauth/clients/validate?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setClient(j.data);
        setValidating(false);
      })
      .catch(() => setValidating(false));
  }, [clientId, redirectUri]);

  const invalid =
    !clientId ||
    !redirectUri ||
    responseType !== 'code' ||
    (!validating && (!client || !client.redirect_allowed));

  if (authLoading || !session || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal">
        <Loader2 size={24} className="animate-spin text-white/70" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-ink mb-2">Invalid request</h2>
          <p className="text-muted text-sm">
            This authorization link is missing or has an unrecognized client.
            {!client && clientId && ' The client_id was not found.'}
            {client && !client.redirect_allowed && ' The redirect_uri is not registered for this client.'}
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

      const res = await fetch('/api/oauth/approve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          scope,
          code_challenge: codeChallenge || undefined,
          code_challenge_method: codeChallengeMethod || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Authorization failed');

      window.location.href = json.redirect_to;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
      setApproving(false);
    }
  };

  const handleDeny = () => {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
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
          <h1 className="text-xl font-semibold text-ink">Allow access?</h1>
          <p className="text-sm text-faint mt-2">
            <strong className="text-ink">{client?.name}</strong> is requesting permission to
            read your data on behalf of:
          </p>
          <p className="text-sm text-ink font-medium mt-3">
            {teamMember?.name || session.user.email}
          </p>
          {teamMember?.name && (
            <p className="text-xs text-faint">{session.user.email}</p>
          )}
        </div>

        <div className="bg-surface rounded-lg p-4 mb-6 text-xs text-muted space-y-1.5">
          <p>This will allow the integration to:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Read data from your connected data sources</li>
            <li>Act as you when querying the AgencyViz API</li>
          </ul>
          <p className="pt-2">
            You can revoke access at any time from Settings → API Keys.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleDeny}
            disabled={approving}
          >
            Deny
          </Button>
          <Button
            fullWidth
            loading={approving}
            onClick={handleApprove}
          >
            Approve
          </Button>
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
