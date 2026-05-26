// components/admin/connectors/MetaConnectionsManager.tsx
//
// Meta-specific post-card details: shows the Meta → Looker Studio deployment
// ID with setup instructions, and lists every Meta connection linked to the
// caller's company with a disconnect action per connection. Lives alongside
// MetaConnectorCard on /integrations/looker-studio; GHL (when it ships) will
// get its own manager with its own deployment ID because each community
// connector has a distinct Apps Script project.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

// Apps Script deployment ID (AKfyc…) for the Meta Looker Studio community
// connector. Distinct from the Apps Script project's *script* id — Looker
// Studio's "Build with Apps Script" dialog expects the deployment id.
// Per-connector env var: each connector has its own Apps Script project and
// deployment lifecycle (NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_GHL, etc.).
const META_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META || '';

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

function DeploymentIdField() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(META_DEPLOYMENT_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (e.g., insecure origin) — text remains selectable.
    }
  };
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 px-3 py-2 text-[12px] font-mono text-ink bg-white border border-line rounded-lg overflow-x-auto whitespace-nowrap">
        {META_DEPLOYMENT_ID}
      </code>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={copy}
        leftIcon={copied ? Check : Copy}
        aria-label="Copy deployment ID"
        className="shrink-0"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function MetaSetupPanel() {
  return (
    <div className="p-6 bg-surface border border-line rounded-2xl">
      <p className="text-sm font-semibold text-ink mb-1">
        Facebook Ads in Looker Studio
      </p>
      <p className="text-xs text-faint leading-relaxed mb-5">
        Paste the Facebook Ads deployment ID below into Looker Studio to load
        the AgencyViz connector.
      </p>

      <div className="mb-5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
          Deployment ID
        </label>
        <DeploymentIdField />
      </div>

      <ol className="space-y-3 text-xs text-ink leading-relaxed list-decimal pl-5 marker:text-muted marker:font-semibold">
        <li>
          Open{' '}
          <a
            href="https://lookerstudio.google.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-teal hover:underline"
          >
            Looker Studio
          </a>{' '}
          and click <span className="font-semibold">Create → Data source</span>.
        </li>
        <li>
          Scroll to <span className="font-semibold">Build your own</span> and choose{' '}
          <span className="font-semibold">Build with Apps Script</span> (aka "Create from
          scratch").
        </li>
        <li>
          Paste the deployment ID above into the{' '}
          <span className="font-semibold">Deployment ID</span> field and click{' '}
          <span className="font-semibold">Validate</span>, then{' '}
          <span className="font-semibold">Next</span>.
        </li>
        <li>
          When prompted, sign in with AgencyViz to authorize the connector, then pick the
          ad account to pull data from.
        </li>
      </ol>
    </div>
  );
}

interface Props {
  refreshKey: number;
  onChange: () => void;
}

export default function MetaConnectionsManager({ refreshKey, onChange }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Hide while the initial fetch is in flight so we don't flash a setup panel
  // that might immediately be followed by a populated connections list.
  if (loading) return null;

  return (
    <div className="mt-8 space-y-6">
      <MetaSetupPanel />

      {connections.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Connected Facebook accounts
          </p>

          {connections.map((connection) => {
            const accountCount = accounts.filter((a) => a.connection_id === connection.id).length;
            return (
              <div
                key={connection.id}
                className="flex items-start gap-3 bg-white border border-line rounded-2xl p-5"
              >
                <div className="w-9 h-9 bg-teal-tint rounded-lg flex items-center justify-center shrink-0">
                  <Users size={16} className="text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {connection.meta_user_name || connection.meta_user_id}
                  </p>
                  <p className="text-xs text-faint mt-0.5">
                    {accountCount} ad account{accountCount === 1 ? '' : 's'} · last used{' '}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
