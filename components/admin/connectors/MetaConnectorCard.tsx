// components/admin/connectors/MetaConnectorCard.tsx
//
// Facebook Ads connector card. Self-contained: fetches current connection
// state from /api/connectors/meta/accounts and kicks off OAuth via
// /api/connectors/meta/oauth/start. Presentation delegated to ConnectorCard.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ConnectorCard, { ConnectorStatus } from './ConnectorCard';

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
  enabled: boolean;
}

interface AccountsResponse {
  success: true;
  data: { connections: Connection[]; accounts: AdAccount[] };
}

// Inline Facebook wordmark 'f' — lucide ships a "Facebook" glyph but it's the
// circle icon; this matches the square brand tile better.
function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
      <path
        fill="#ffffff"
        d="M14.5 21v-7.6h2.55l.38-2.96H14.5V8.55c0-.86.24-1.44 1.47-1.44h1.57V4.46c-.27-.04-1.2-.12-2.28-.12-2.25 0-3.79 1.37-3.79 3.9v2.2H8.9v2.96h2.58V21h3.02Z"
      />
    </svg>
  );
}

export default function MetaConnectorCard() {
  const [status, setStatus] = useState<ConnectorStatus>('disconnected');
  const [detail, setDetail] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connectors/meta/accounts', { headers: await authHeader() });
      if (!res.ok) {
        setStatus('disconnected');
        setDetail(undefined);
        return;
      }
      const json = (await res.json()) as AccountsResponse;
      const active = json.data.connections.find((c) => c.status === 'active');
      const needsReauth = json.data.connections.find((c) => c.status === 'needs_reauth');

      if (active) {
        setStatus('connected');
        const enabledCount = json.data.accounts.filter((a) => a.enabled).length;
        const who = active.meta_user_name || active.meta_user_id;
        setDetail(`Connected as ${who} · ${enabledCount} ad account${enabledCount === 1 ? '' : 's'} available`);
      } else if (needsReauth) {
        setStatus('needs_reauth');
        setDetail('Facebook requires you to re-authorize to keep pulling data.');
      } else {
        setStatus('disconnected');
        setDetail(undefined);
      }
    } catch {
      setStatus('disconnected');
      setDetail(undefined);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/connectors/meta/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ redirect_to: '/ads/looker-studio' }),
      });
      const json = await res.json();
      if (json.success && json.authorize_url) {
        window.location.href = json.authorize_url;
      } else {
        alert(json.error || 'Failed to start Facebook connection');
        setStarting(false);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start Facebook connection');
      setStarting(false);
    }
  };

  const primaryLabel =
    status === 'connected' ? 'Reconnect'
    : status === 'needs_reauth' ? 'Re-authorize'
    : 'Connect Facebook';

  return (
    <ConnectorCard
      icon={<FacebookGlyph />}
      iconBg="bg-[#1877F2]"
      name="Facebook Ads"
      description="Pull campaign, ad set, ad, and creative performance from Meta into Looker Studio. Supports daily, weekly, and custom date ranges."
      status={loading ? 'disconnected' : status}
      statusDetail={detail}
      primaryAction={{
        label: primaryLabel,
        onClick: connect,
        loading: starting,
        disabled: loading,
      }}
    />
  );
}
