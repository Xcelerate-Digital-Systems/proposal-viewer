// app/settings/page.tsx
'use client';

import { useState } from 'react';
import { Bell, Eye, CheckCircle2, MessageSquare, CheckCheck, Loader2, Settings } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { TeamMember } from '@/lib/supabase';

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

export default function SettingsPage() {
  return (
    <AdminLayout>
      {(auth) => <SettingsContent auth={auth} />}
    </AdminLayout>
  );
}

function SettingsContent({ auth }: { auth: { teamMember: TeamMember | null; signOut: () => Promise<void>; updatePreferences: (prefs: Partial<TeamMember>) => Promise<{ error: unknown } | undefined> } }) {
  const { teamMember, updatePreferences } = auth;
  const [saving, setSaving] = useState<string | null>(null);

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
          <h1 className="text-xl font-semibold text-gray-900">Notification Settings</h1>
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