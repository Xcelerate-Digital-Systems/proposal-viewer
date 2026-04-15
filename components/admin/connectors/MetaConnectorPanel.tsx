// components/admin/connectors/MetaConnectorPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Link as LinkIcon, AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Connection {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  status: 'active' | 'needs_reauth' | 'revoked';
  expires_at: string;
}

interface AdAccount {
  connection_id: string;
  ad_account_id: string;
  account_name: string | null;
  currency: string | null;
  timezone_name: string | null;
  business_name: string | null;
  enabled: boolean;
}

interface AccountsResponse {
  success: true;
  data: { connections: Connection[]; accounts: AdAccount[] };
}

export default function MetaConnectorPanel() {
  const search = useSearchParams();
  const connected = search.get('connected') === '1';
  const error = search.get('error');

  const debugMode = search.get('debug') === '1';
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [starting, setStarting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugRaw, setDebugRaw] = useState<string | null>(null);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        debugMode ? '/api/connectors/meta/accounts?debug=1' : '/api/connectors/meta/accounts',
        { headers: await authHeader() },
      );
      const text = await res.text();
      setDebugRaw(`HTTP ${res.status}\n${text}`);
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok) {
        setLoadError(`API returned ${res.status}: ${text.slice(0, 200)}`);
      } else if (json && typeof json === 'object' && 'success' in json) {
        const j = json as AccountsResponse;
        setConnections(j.data.connections);
        setAccounts(j.data.accounts);
      } else {
        setLoadError(`Unexpected response: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    setStarting(true);
    const res = await fetch('/api/connectors/meta/oauth/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ redirect_to: '/settings/connectors/meta' }),
    });
    const json = await res.json();
    if (json.success && json.authorize_url) {
      window.location.href = json.authorize_url;
    } else {
      setStarting(false);
      alert(json.error || 'Failed to start OAuth');
    }
  };

  const activeConnection = connections.find((c) => c.status === 'active');
  const needsReauth = connections.find((c) => c.status === 'needs_reauth');

  return (
    <div className="space-y-6">
      {connected && (
        <div className="flex items-start gap-3 p-4 bg-teal-tint border border-teal/30 rounded-xl">
          <CheckCircle2 size={18} className="text-teal mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink">Facebook connected</p>
            <p className="text-xs text-faint">Your ad accounts are listed below.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink">Couldn't complete the connection</p>
            <p className="text-xs text-faint break-all">{decodeURIComponent(error)}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-tint rounded-[14px] flex items-center justify-center">
          <LinkIcon size={20} className="text-teal" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-ink">Facebook Ads → Looker Studio</h1>
          <p className="text-sm text-faint">
            Connect Meta once, then pull ad performance into Looker Studio with the AgencyViz connector.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-faint hover:text-ink border border-line rounded-lg disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-ink">Couldn't load connection state</p>
          <pre className="mt-2 text-xs text-muted whitespace-pre-wrap break-all">{loadError}</pre>
        </div>
      )}

      {debugMode && debugRaw && (
        <div className="p-4 bg-gray-50 border border-line rounded-xl">
          <p className="text-xs font-semibold text-muted mb-2">Debug: /api/connectors/meta/accounts</p>
          <pre className="text-xs text-faint whitespace-pre-wrap break-all">{debugRaw}</pre>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-faint" />
        </div>
      ) : activeConnection ? (
        <div className="max-w-2xl space-y-4">
          <div className="p-4 bg-white border border-line rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Connected as {activeConnection.meta_user_name || activeConnection.meta_user_id}
                </p>
                <p className="text-xs text-faint">
                  Token refreshes automatically · expires{' '}
                  {new Date(activeConnection.expires_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={connect}
                disabled={starting}
                className="px-3 py-1.5 text-xs font-medium text-faint hover:text-ink border border-line rounded-lg"
              >
                {starting ? 'Starting…' : 'Reconnect'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted mb-2">
              Ad accounts ({accounts.length})
            </p>
            {accounts.length === 0 ? (
              <p className="text-xs text-faint">
                No ad accounts found on this Meta user. Make sure you have access to an ad account in Business Manager.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div
                    key={a.ad_account_id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white border border-line rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {a.account_name || a.ad_account_id}
                      </p>
                      <p className="text-xs text-faint font-mono truncate">
                        {a.ad_account_id}
                        {a.business_name && <span className="ml-2 font-sans">· {a.business_name}</span>}
                        {a.currency && <span className="ml-2 font-sans">· {a.currency}</span>}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${a.enabled ? 'bg-teal-tint text-teal' : 'bg-gray-100 text-faint'}`}>
                      {a.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-lg p-6 bg-white border border-line rounded-xl">
          {needsReauth && (
            <div className="mb-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5" />
              <p className="text-xs text-muted">
                Your existing Facebook connection needs to be re-authorized.
              </p>
            </div>
          )}
          <p className="text-sm text-muted mb-4">
            You'll be redirected to Facebook to authorize AgencyViz to read your ad data. We never
            post, never access personal profile data, and store only an encrypted access token.
          </p>
          <button
            onClick={connect}
            disabled={starting}
            className="px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-teal/90 disabled:opacity-50 flex items-center gap-2"
          >
            {starting ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {starting ? 'Redirecting…' : 'Connect Facebook'}
          </button>
        </div>
      )}
    </div>
  );
}
