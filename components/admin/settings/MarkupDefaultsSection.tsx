// components/admin/settings/MarkupDefaultsSection.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, MessageSquare, CornerDownRight, CheckCheck, Layers, Package,
  type LucideIcon,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import {
  ALL_ON_PREFS, MARKUP_NOTIFY_KEYS, type MarkupNotifyPrefs,
} from '@/lib/markup-notification-defaults';

type PrefKey = (typeof MARKUP_NOTIFY_KEYS)[number];

const PREF_DEFS: { key: PrefKey; label: string; description: string; icon: LucideIcon }[] = [
  { key: 'notify_comment',     label: 'Comments',       description: 'New top-level comments on a project',         icon: MessageSquare },
  { key: 'notify_reply',       label: 'Replies',        description: 'Replies to existing comment threads',         icon: CornerDownRight },
  { key: 'notify_resolve',     label: 'Resolved',       description: 'When a comment is marked resolved',           icon: CheckCheck },
  { key: 'notify_status',      label: 'Status changes', description: 'When an item moves between pipeline stages',  icon: Layers },
  { key: 'notify_new_version', label: 'New versions',   description: 'When someone uploads a new version of an item', icon: Package },
];

export default function MarkupDefaultsSection({ canEdit }: { canEdit: boolean }) {
  const [prefs, setPrefs] = useState<MarkupNotifyPrefs>(ALL_ON_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authFetch('/api/company/markup-notification-defaults');
      if (res.ok) {
        const data = await res.json();
        if (!cancelled && data?.defaults) setPrefs(data.defaults);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async (key: PrefKey) => {
    if (!canEdit || savingKey) return;
    const next = !prefs[key];
    setSavingKey(key);
    setPrefs((p) => ({ ...p, [key]: next }));
    const res = await authFetch('/api/company/markup-notification-defaults', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaults: { [key]: next } }),
    });
    if (!res.ok) {
      // Revert on failure so the UI doesn't lie about persistence.
      setPrefs((p) => ({ ...p, [key]: !next }));
    } else {
      const data = await res.json().catch(() => null);
      if (data?.defaults) setPrefs(data.defaults);
    }
    setSavingKey(null);
  };

  if (loading) {
    return (
      <div className="bg-white border border-edge rounded-[14px] px-4 py-6 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-faint" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-edge rounded-[14px] overflow-hidden">
      <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">Campaign defaults</span>
        <span className="text-2xs font-semibold uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded">
          Agency
        </span>
      </div>
      <div className="px-4 py-3 border-b border-edge text-xs text-faint">
        Default email alerts for new project assignees and guest reviewers.
        Each project can still override these per-person.
      </div>
      <div className="divide-y divide-edge">
        {PREF_DEFS.map((opt) => {
          const enabled = prefs[opt.key];
          const saving = savingKey === opt.key;
          return (
            <div key={opt.key} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <opt.icon size={15} className={enabled ? 'text-teal shrink-0' : 'text-faint shrink-0'} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{opt.label}</p>
                  <p className="text-xs text-faint truncate">{opt.description}</p>
                </div>
              </div>
              <button
                onClick={() => toggle(opt.key)}
                disabled={!canEdit || saving}
                title={canEdit ? undefined : 'Owners and admins can change agency defaults'}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  enabled ? 'bg-teal' : 'bg-edge'
                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                ) : (
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform absolute top-0.5 ${
                      enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
