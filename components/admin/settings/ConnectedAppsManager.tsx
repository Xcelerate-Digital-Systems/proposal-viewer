// components/admin/settings/ConnectedAppsManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Chrome, BarChart3, Plug, Unplug } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Source = 'oauth_extension' | 'oauth_client';

interface ConnectedApp {
  source: Source;
  label: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  connected_at: string;
  last_used_at: string | null;
  token_count: number;
}

// Pick an icon per integration. Falls back to a generic plug for unknowns
// (e.g. a future OAuth client we haven't branded yet).
function iconFor(app: ConnectedApp) {
  if (app.source === 'oauth_extension') return Chrome;
  if (/looker|studio/i.test(app.label)) return BarChart3;
  return Plug;
}

export default function ConnectedAppsManager() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/settings/connected-apps', { headers: await authHeader() });
    const json = await res.json();
    if (json.success) setApps(json.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const disconnect = async (app: ConnectedApp) => {
    const who = app.user_email ?? app.user_name ?? 'this user';
    if (!confirm(`Disconnect ${app.label} for ${who}? They will need to reauthorize to use it again.`)) return;
    const groupKey = `${app.source}|${app.label}|${app.user_id}`;
    setDisconnecting(groupKey);
    const params = new URLSearchParams({
      source: app.source,
      label: app.label,
      user_id: app.user_id,
    });
    await fetch(`/api/settings/connected-apps?${params.toString()}`, {
      method: 'DELETE',
      headers: await authHeader(),
    });
    setDisconnecting(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-faint" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <p className="max-w-lg text-xs text-faint py-6 text-center">
        No connected apps yet. The Chrome extension and Looker Studio connector show up here once authorized.
      </p>
    );
  }

  return (
    <div className="max-w-lg space-y-2">
      {apps.map((app) => {
        const Icon = iconFor(app);
        const groupKey = `${app.source}|${app.label}|${app.user_id}`;
        const isDisconnecting = disconnecting === groupKey;
        const who = app.user_email ?? app.user_name ?? 'Unknown user';
        return (
          <div
            key={groupKey}
            className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white border border-line rounded-lg"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center shrink-0">
                <Icon size={16} className="text-teal" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{app.label}</p>
                <p className="text-xs text-faint truncate">
                  {who}
                  {app.last_used_at ? (
                    <> · last used {new Date(app.last_used_at).toLocaleDateString()}</>
                  ) : (
                    <> · never used</>
                  )}
                  {app.token_count > 1 && (
                    <> · {app.token_count} tokens</>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => disconnect(app)}
              disabled={isDisconnecting}
              className="px-2.5 py-1.5 text-xs font-medium text-faint hover:text-red-500 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              title="Disconnect"
            >
              {isDisconnecting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Unplug size={13} />
              )}
              Disconnect
            </button>
          </div>
        );
      })}
    </div>
  );
}
