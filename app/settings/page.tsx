// app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Bell, Eye, CheckCircle2, MessageSquare, CheckCheck,
  Loader2, Settings, Webhook, Trash2, Copy, Check,
  EyeOff, RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase, TeamMember, WebhookEndpoint } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

const NOTIFICATION_OPTIONS = [
  {
    key: 'notify_proposal_viewed' as const,
    label: 'Proposal Viewed',
    description: 'When a client opens a proposal for the first time',
    icon: Eye,
  },
  {
    key: 'notify_proposal_accepted' as const,
    label: 'Proposal Accepted',
    description: 'When a client accepts a proposal',
    icon: CheckCircle2,
  },
  {
    key: 'notify_comment_added' as const,
    label: 'New Comment',
    description: 'When someone adds a comment on a proposal',
    icon: MessageSquare,
  },
  {
    key: 'notify_comment_resolved' as const,
    label: 'Comment Resolved',
    description: 'When a comment is marked as resolved',
    icon: CheckCheck,
  },
];

const WEBHOOK_EVENTS = [
  {
    key: 'proposal_viewed' as const,
    label: 'Proposal Viewed',
    description: 'Fires when a client opens a proposal for the first time',
    icon: Eye,
  },
  {
    key: 'proposal_accepted' as const,
    label: 'Proposal Accepted',
    description: 'Fires when a client accepts a proposal',
    icon: CheckCircle2,
  },
  {
    key: 'comment_added' as const,
    label: 'Comment Added',
    description: 'Fires when someone adds a comment on a proposal',
    icon: MessageSquare,
  },
  {
    key: 'comment_resolved' as const,
    label: 'Comment Resolved',
    description: 'Fires when a comment is marked as resolved',
    icon: CheckCheck,
  },
];

export default function SettingsPage() {
  return (
    <AdminLayout>
      {(auth) => <SettingsContent auth={auth} />}
    </AdminLayout>
  );
}

function SettingsContent({ auth }: { auth: { teamMember: TeamMember | null; companyId: string | null; signOut: () => Promise<void>; updatePreferences: (prefs: Partial<TeamMember>) => Promise<{ error: unknown } | undefined> } }) {
  const { teamMember, companyId, updatePreferences } = auth;
  const [saving, setSaving] = useState<string | null>(null);
  const isAdminOrOwner = teamMember?.role === 'owner' || teamMember?.role === 'admin';

  const handleToggle = async (key: (typeof NOTIFICATION_OPTIONS)[number]['key']) => {
    if (!teamMember) return;
    setSaving(key);
    await updatePreferences({ [key]: !teamMember[key] });
    setSaving(null);
  };

  return (
    <div className="px-6 lg:px-10 py-8 max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-[#017C87]/10 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-[#017C87]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-400">
            Signed in as <span className="text-gray-500">{teamMember?.email}</span>
          </p>
        </div>
      </div>

      {/* Notification toggles */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Bell size={15} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Email Notifications</span>
        </div>

        <div className="divide-y divide-gray-100">
          {NOTIFICATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const enabled = teamMember?.[opt.key] ?? true;

            return (
              <div key={opt.key} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Icon size={18} className={enabled ? 'text-[#017C87]' : 'text-gray-300'} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(opt.key)}
                  disabled={saving === opt.key}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enabled ? 'bg-[#017C87]' : 'bg-gray-200'
                  }`}
                >
                  {saving === opt.key ? (
                    <Loader2 size={14} className="animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  ) : (
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform absolute top-0.5 shadow-sm ${
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

      {/* Name update */}
      <NameEditor name={teamMember?.name || ''} onSave={(name) => updatePreferences({ name })} />

      {/* Webhooks — only for owners and admins */}
      {isAdminOrOwner && companyId && (
        <WebhookManager companyId={companyId} />
      )}
    </div>
  );
}

function NameEditor({ name: initialName, onSave }: { name: string; onSave: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const changed = name !== initialName;

  const handleSave = async () => {
    if (!name.trim() || !changed) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
  };

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <label className="block text-sm font-medium text-gray-500 mb-2">Display Name</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
        />
        {changed && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Webhook Manager ---

function WebhookManager({ companyId }: { companyId: string }) {
  const toast = useToast();
  const [endpoints, setEndpoints] = useState<Record<string, WebhookEndpoint | null>>({});
  const [loading, setLoading] = useState(true);

  const fetchEndpoints = async () => {
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('company_id', companyId);

    // Build a map keyed by event_type
    const map: Record<string, WebhookEndpoint | null> = {};
    for (const evt of WEBHOOK_EVENTS) {
      map[evt.key] = (data || []).find((d: WebhookEndpoint) => d.event_type === evt.key) || null;
    }
    setEndpoints(map);
    setLoading(false);
  };

  useEffect(() => { fetchEndpoints(); }, [companyId]);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#017C87]/10 rounded-lg flex items-center justify-center">
          <Webhook size={16} className="text-[#017C87]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Webhooks</h2>
          <p className="text-xs text-gray-400">Send HTTP POST requests when proposal events occur</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-3">
          {WEBHOOK_EVENTS.map((evt) => (
            <WebhookEventCard
              key={evt.key}
              eventKey={evt.key}
              label={evt.label}
              description={evt.description}
              icon={evt.icon}
              endpoint={endpoints[evt.key] || null}
              companyId={companyId}
              onRefresh={fetchEndpoints}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 px-1">
        Each event can have its own endpoint URL. If a signing secret is set, requests include an <code className="text-gray-500">X-Webhook-Signature</code> header with an HMAC-SHA256 signature.
      </p>
    </div>
  );
}

// --- Individual Webhook Event Card ---

function WebhookEventCard({
  eventKey,
  label,
  description,
  icon: Icon,
  endpoint,
  companyId,
  onRefresh,
}: {
  eventKey: string;
  label: string;
  description: string;
  icon: LucideIcon;
  endpoint: WebhookEndpoint | null;
  companyId: string;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState(endpoint?.url || '');
  const [secret, setSecret] = useState(endpoint?.secret || '');
  const [enabled, setEnabled] = useState(endpoint?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Track whether anything changed from saved state
  const hasEndpoint = !!endpoint;
  const urlChanged = url.trim() !== (endpoint?.url || '');
  const secretChanged = secret.trim() !== (endpoint?.secret || '');
  const enabledChanged = hasEndpoint && enabled !== endpoint.enabled;
  const hasChanges = urlChanged || secretChanged || enabledChanged;
  const hasUrl = url.trim().length > 0;

  const generateSecret = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    setSecret(Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(''));
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!url.trim()) {
      // If URL is empty and endpoint exists, delete it
      if (hasEndpoint) {
        await handleRemove();
      }
      return;
    }

    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setSaving(true);

    if (hasEndpoint) {
      // Update existing
      const { error } = await supabase
        .from('webhook_endpoints')
        .update({
          url: url.trim(),
          secret: secret.trim() || null,
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', endpoint.id);

      if (error) {
        toast.error('Failed to save webhook');
      } else {
        toast.success(`${label} webhook saved`);
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('webhook_endpoints')
        .insert({
          company_id: companyId,
          event_type: eventKey,
          url: url.trim(),
          secret: secret.trim() || null,
          enabled,
        });

      if (error) {
        toast.error('Failed to save webhook');
      } else {
        toast.success(`${label} webhook created`);
      }
    }

    setSaving(false);
    onRefresh();
  };

  const handleRemove = async () => {
    if (!hasEndpoint) return;
    setSaving(true);
    await supabase.from('webhook_endpoints').delete().eq('id', endpoint.id);
    setUrl('');
    setSecret('');
    setEnabled(true);
    setShowSecret(false);
    toast.success(`${label} webhook removed`);
    setSaving(false);
    onRefresh();
  };

  const handleToggleEnabled = async () => {
    if (!hasEndpoint) return;
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    await supabase
      .from('webhook_endpoints')
      .update({ enabled: newEnabled, updated_at: new Date().toISOString() })
      .eq('id', endpoint.id);
    onRefresh();
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-opacity ${hasEndpoint && !enabled ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon size={16} className={hasEndpoint && enabled ? 'text-[#017C87]' : 'text-gray-300'} />
          <div>
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasEndpoint && (
            <>
              <button
                onClick={handleToggleEnabled}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  enabled ? 'bg-[#017C87]' : 'bg-gray-200'
                }`}
                title={enabled ? 'Disable webhook' : 'Enable webhook'}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5 shadow-sm ${
                    enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <button
                onClick={handleRemove}
                disabled={saving}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove webhook"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* URL + Secret fields */}
      <div className="px-5 pb-4 space-y-2.5">
        <div>
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Endpoint URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/proposals"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Signing Secret <span className="text-gray-300 normal-case">(optional)</span>
          </label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Used to verify webhook authenticity"
                className="w-full px-3 py-2 pr-16 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400 placeholder:font-sans"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
                {secret && (
                  <button
                    type="button"
                    onClick={copySecret}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                    title="Copy secret"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={generateSecret}
              className="px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              title="Generate random secret"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Save button — only when there are changes and a URL */}
        {hasChanges && hasUrl && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {hasEndpoint ? 'Save' : 'Create'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}