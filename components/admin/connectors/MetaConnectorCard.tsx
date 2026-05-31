// components/admin/connectors/MetaConnectorCard.tsx
//
// Meta / Facebook Ads connection card for Settings → Integrations.
// Handles OAuth connection and ad account management. Looker Studio
// setup instructions live on the Looker Studio page.

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Plus, Trash2, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';

type ConnectionStatus = 'active' | 'needs_reauth' | 'revoked';

interface Connection {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  status: ConnectionStatus;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
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

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusPill({
  state,
}: {
  state: 'connected' | 'needs_reauth' | 'disconnected';
}) {
  const config = {
    connected:    { label: 'Connected',     cls: 'bg-teal-tint text-teal' },
    needs_reauth: { label: 'Needs reauth',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    disconnected: { label: 'Not connected', cls: 'bg-surface text-faint' },
  }[state];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-detail font-medium rounded-full ${config.cls}`}>
      {config.label}
    </span>
  );
}

interface Props {
  /** Bump to force the card to re-fetch. */
  refreshKey?: number;
  onChange?: () => void;
}

export default function MetaConnectorCard({ refreshKey = 0, onChange }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connectors/meta/accounts', {
        headers: await authHeader(),
      });
      if (!res.ok) {
        setConnections([]);
        setAccounts([]);
        return;
      }
      const json = (await res.json()) as AccountsResponse;
      setConnections(json.data.connections);
      setAccounts(json.data.accounts);
    } catch {
      setConnections([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const connect = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/connectors/meta/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ redirect_to: '/settings?tab=integrations' }),
      });
      const json = await res.json();
      if (json.success && json.authorize_url) {
        window.location.href = json.authorize_url;
      } else {
        toast.error(json.error || 'Failed to start Facebook connection');
        setStarting(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start Facebook connection');
      setStarting(false);
    }
  };

  const disconnect = async (connection: Connection) => {
    const who = connection.meta_user_name || connection.meta_user_id;
    const ok = await confirm({
      title: 'Disconnect Facebook?',
      message: `This will revoke the connection for ${who}. Any Looker Studio reports using these ad accounts will stop receiving data until a team member reconnects.`,
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;

    setPendingDisconnect(connection.id);
    try {
      const res = await fetch('/api/connectors/meta/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ connection_id: connection.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to disconnect');
      toast.success(`Disconnected ${who}`);
      onChange?.();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setPendingDisconnect(null);
    }
  };

  const activeConnections = connections.filter((c) => c.status !== 'revoked');
  const hasConnection = activeConnections.length > 0;
  const needsReauth = !hasConnection
    ? false
    : activeConnections.every((c) => c.status === 'needs_reauth');
  const headerState: 'connected' | 'needs_reauth' | 'disconnected' = loading
    ? 'disconnected'
    : needsReauth
      ? 'needs_reauth'
      : hasConnection
        ? 'connected'
        : 'disconnected';

  return (
    <section className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Header band — matches dashboard section header */}
      <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-edge">
        <div className="flex items-start gap-3 min-w-0">
          <Image
            src="/integrations/facebook-icon.png"
            alt="Meta / Facebook"
            width={40}
            height={40}
            className="rounded-2xl shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-ink">Meta / Facebook Ads</h2>
              <StatusPill state={headerState} />
            </div>
            <p className="text-xs text-faint mt-1 leading-relaxed max-w-[58ch]">
              Connect your Facebook Ads accounts to pipe campaign and creative data into Looker Studio reports.
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-faint py-3">
            <Loader2 size={13} className="animate-spin" />
            Loading connections…
          </div>
        ) : hasConnection ? (
          <div className="space-y-2">
            {activeConnections.map((connection) => {
              const accountCount = accounts.filter(
                (a) => a.connection_id === connection.id,
              ).length;
              const isDisconnecting = pendingDisconnect === connection.id;
              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white border border-edge rounded-2xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center shrink-0">
                      <Users size={15} className="text-teal" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink truncate">
                          {connection.meta_user_name || connection.meta_user_id}
                        </p>
                        {connection.status === 'needs_reauth' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-2xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Needs reauth
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-faint truncate">
                        {accountCount} ad account{accountCount === 1 ? '' : 's'} · last used{' '}
                        {formatRelativeTime(connection.last_used_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect(connection)}
                    disabled={isDisconnecting}
                    className="px-2.5 py-1.5 text-xs font-medium text-faint hover:text-red-500 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
                    title="Disconnect"
                  >
                    {isDisconnecting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              );
            })}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={connect}
                disabled={starting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:text-teal-hover disabled:opacity-50 transition-colors"
              >
                {starting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add another Facebook account
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-surface rounded-2xl">
            <p className="text-xs text-muted leading-relaxed">
              Sign in with Facebook to authorize AgencyViz to read your ad account performance.
              Each team member can connect their own Facebook account.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={connect}
              loading={starting}
              className="shrink-0"
            >
              Connect Facebook
            </Button>
          </div>
        )}
      </div>

    </section>
  );
}
