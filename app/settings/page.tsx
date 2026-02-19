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
        <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-[#ff6700]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Notification Settings</h1>
          <p className="text-sm text-[#666]">
            Signed in as <span className="text-[#999]">{teamMember?.email}</span>
          </p>
        </div>
      </div>

      {/* Notification toggles */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
          <Bell size={15} className="text-[#666]" />
          <span className="text-sm font-medium text-[#999]">Email Notifications</span>
        </div>

        <div className="divide-y divide-[#2a2a2a]">
          {NOTIFICATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const enabled = teamMember?.[opt.key] ?? true;

            return (
              <div key={opt.key} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Icon size={18} className={enabled ? 'text-[#ff6700]' : 'text-[#444]'} />
                  <div>
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-xs text-[#666] mt-0.5">{opt.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(opt.key)}
                  disabled={saving === opt.key}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enabled ? 'bg-[#ff6700]' : 'bg-[#2a2a2a]'
                  }`}
                >
                  {saving === opt.key ? (
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
    <div className="mt-6 bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
      <label className="block text-sm font-medium text-[#999] mb-2">Display Name</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
        />
        {changed && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#ff6700] text-white text-sm rounded-lg hover:bg-[#e85d00] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}