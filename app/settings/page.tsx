// app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Bell, Eye, CheckCircle2, MessageSquare, CheckCheck,
  Loader2, Settings, Webhook, Plus, Trash2, Copy, Check,
  EyeOff, ExternalLink, RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase, TeamMember, Webhook as WebhookType } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

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
  { key: 'on_proposal_viewed' as const, label: 'Proposal Viewed' },
  { key: 'on_proposal_accepted' as const, label: 'Proposal Accepted' },
  { key: 'on_comment_added' as const, label: 'Comment Added' },
  { key: 'on_comment_resolved' as const, label: 'Comment Resolved' },
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
  const confirm = useConfirm();
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchWebhooks = async () => {
    const { data } = await supabase
      .from('webhooks')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    setWebhooks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWebhooks(); }, [companyId]);

  const toggleEnabled = async (webhook: WebhookType) => {
    await supabase.from('webhooks')
      .update({ enabled: !webhook.enabled, updated_at: new Date().toISOString() })
      .eq('id', webhook.id);
    fetchWebhooks();
  };

  const toggleEvent = async (webhook: WebhookType, eventKey: keyof WebhookType) => {
    await supabase.from('webhooks')
      .update({ [eventKey]: !webhook[eventKey], updated_at: new Date().toISOString() })
      .eq('id', webhook.id);
    fetchWebhooks();
  };

  const deleteWebhook = async (webhook: WebhookType) => {
    const ok = await confirm({
      title: 'Delete Webhook',
      message: `Delete webhook for ${webhook.url}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('webhooks').delete().eq('id', webhook.id);
    toast.success('Webhook deleted');
    fetchWebhooks();
  };

  return (
    <div className="mt-8">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook size={15} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Webhooks</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
          >
            <Plus size={13} />
            Add Webhook
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {showForm && (
              <WebhookForm
                companyId={companyId}
                onSaved={() => { setShowForm(false); fetchWebhooks(); }}
                onCancel={() => setShowForm(false)}
              />
            )}

            {webhooks.length === 0 && !showForm ? (
              <div className="py-8 text-center">
                <Webhook size={24} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No webhooks configured</p>
                <p className="text-xs text-gray-300 mt-1">Webhooks send HTTP POST requests when proposal events occur</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {webhooks.map((wh) => (
                  <WebhookRow
                    key={wh.id}
                    webhook={wh}
                    onToggleEnabled={() => toggleEnabled(wh)}
                    onToggleEvent={(key) => toggleEvent(wh, key)}
                    onDelete={() => deleteWebhook(wh)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 px-1">
        Webhooks fire at the same time as email notifications. If a signing secret is set, requests include an <code className="text-gray-500">X-Webhook-Signature</code> header with an HMAC-SHA256 signature.
      </p>
    </div>
  );
}

// --- Add Webhook Form ---

function WebhookForm({ companyId, onSaved, onCancel }: { companyId: string; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const generateSecret = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    setSecret(Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('webhooks').insert({
      company_id: companyId,
      url: url.trim(),
      secret: secret.trim() || null,
      description: description.trim() || null,
    });

    if (error) {
      toast.error('Failed to create webhook');
      setSaving(false);
      return;
    }

    toast.success('Webhook created');
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 border-b border-gray-100 bg-gray-50/50">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint URL</label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/proposals"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Signing Secret <span className="text-gray-300">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Used to verify webhook authenticity"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400 placeholder:font-sans"
            />
            <button
              type="button"
              onClick={generateSecret}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Description <span className="text-gray-300">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Slack notification, CRM sync"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !url.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Create Webhook
        </button>
      </div>
    </form>
  );
}

// --- Webhook Row ---

function WebhookRow({
  webhook,
  onToggleEnabled,
  onToggleEvent,
  onDelete,
}: {
  webhook: WebhookType;
  onToggleEnabled: () => void;
  onToggleEvent: (key: keyof WebhookType) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    if (!webhook.secret) return;
    navigator.clipboard.writeText(webhook.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`px-5 py-4 ${!webhook.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="text-sm text-gray-900 font-mono truncate block">{webhook.url}</code>
            {!webhook.enabled && (
              <span className="shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                DISABLED
              </span>
            )}
          </div>
          {webhook.description && (
            <p className="text-xs text-gray-400 mt-0.5">{webhook.description}</p>
          )}

          {/* Secret display */}
          {webhook.secret && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-gray-300 uppercase tracking-wider">Secret:</span>
              <code className="text-[11px] text-gray-400 font-mono">
                {webhook.secret.slice(0, 8)}{'•'.repeat(8)}
              </code>
              <button onClick={copySecret} className="text-gray-300 hover:text-gray-500 transition-colors">
                {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              </button>
            </div>
          )}

          {/* Event toggles */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {WEBHOOK_EVENTS.map((evt) => {
              const active = webhook[evt.key];
              return (
                <button
                  key={evt.key}
                  onClick={() => onToggleEvent(evt.key)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#017C87]/10 text-[#017C87] hover:bg-[#017C87]/20'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-150 hover:text-gray-500'
                  }`}
                >
                  {evt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleEnabled}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              webhook.enabled ? 'bg-[#017C87]' : 'bg-gray-200'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5 shadow-sm ${
                webhook.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}