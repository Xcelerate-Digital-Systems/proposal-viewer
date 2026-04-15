// components/admin/connectors/MetaConnectionsManager.tsx
//
// Per-connection management UI shown beneath the connector cards. Lets a
// company admin (a) see which Meta user(s) are linked, (b) toggle individual
// ad accounts on/off so employees don't accidentally expose personal ad
// accounts, and (c) revoke a connection entirely.
//
// Intentionally fetches the same /api/connectors/meta/accounts endpoint as
// MetaConnectorCard. The parent re-keys both on mutation so they stay in
// sync without needing a shared context.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface Connection {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  status: 'active' | 'needs_reauth' | 'revoked';
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
}

interface AdAccount {
  connection_id: string;
  ad_account_id: string;
  account_name: string | null;
  currency?: string | null;
  business_name?: string | null;
  enabled: boolean;
}

interface AccountsResponse {
  success: true;
  data: { connections: Connection[]; accounts: AdAccount[] };
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  refreshKey: number;
  onChange: () => void;
}

export default function MetaConnectionsManager({ refreshKey, onChange }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  // Track per-account mutation state so rapid toggles don't race against each
  // other — the toggle is disabled while its own PATCH is in flight.
  const [pendingAccounts, setPendingAccounts] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const accountKey = (a: Pick<AdAccount, 'connection_id' | 'ad_account_id'>) =>
    `${a.connection_id}:${a.ad_account_id}`;

  const toggleAccount = async (account: AdAccount) => {
    const key = accountKey(account);
    const next = !account.enabled;

    setPendingAccounts((prev) => new Set(prev).add(key));
    // Optimistic update — revert on failure.
    setAccounts((prev) =>
      prev.map((a) => (accountKey(a) === key ? { ...a, enabled: next } : a))
    );

    try {
      const res = await fetch('/api/connectors/meta/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          connection_id: account.connection_id,
          ad_account_id: account.ad_account_id,
          enabled: next,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update ad account');
      }
      onChange();
    } catch (e) {
      setAccounts((prev) =>
        prev.map((a) => (accountKey(a) === key ? { ...a, enabled: !next } : a))
      );
      toast.error(e instanceof Error ? e.message : 'Failed to update ad account');
    } finally {
      setPendingAccounts((prev) => {
        const copy = new Set(prev);
        copy.delete(key);
        return copy;
      });
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
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to disconnect');
      }
      toast.success(`Disconnected ${who}`);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setPendingDisconnect(null);
    }
  };

  if (loading) return null;
  if (connections.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Connected accounts
        </p>
      </div>

      {connections.map((connection) => {
        const connAccounts = accounts.filter((a) => a.connection_id === connection.id);
        const enabledCount = connAccounts.filter((a) => a.enabled).length;

        return (
          <div
            key={connection.id}
            className="bg-white border border-line rounded-2xl overflow-hidden"
          >
            <div className="flex items-start gap-3 p-5 border-b border-line">
              <div className="w-9 h-9 bg-teal-tint rounded-lg flex items-center justify-center shrink-0">
                <Users size={16} className="text-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  {connection.meta_user_name || connection.meta_user_id}
                </p>
                <p className="text-xs text-faint mt-0.5">
                  {enabledCount} of {connAccounts.length} ad account
                  {connAccounts.length === 1 ? '' : 's'} enabled · last used{' '}
                  {formatRelativeTime(connection.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => disconnect(connection)}
                disabled={pendingDisconnect === connection.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Trash2 size={12} />
                {pendingDisconnect === connection.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>

            {connAccounts.length === 0 ? (
              <div className="p-5 text-xs text-faint">
                No ad accounts found on this Meta login.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {connAccounts.map((account) => {
                  const key = accountKey(account);
                  const label = account.account_name || account.ad_account_id;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{label}</p>
                        <p className="text-[11px] text-muted mt-0.5 truncate">
                          {account.ad_account_id}
                          {account.business_name ? ` · ${account.business_name}` : ''}
                          {account.currency ? ` · ${account.currency}` : ''}
                        </p>
                      </div>
                      <Toggle
                        size="sm"
                        enabled={account.enabled}
                        onChange={() => toggleAccount(account)}
                        disabled={pendingAccounts.has(key)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
