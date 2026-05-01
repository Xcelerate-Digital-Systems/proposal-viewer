// app/settings/page.tsx
'use client';

import { useState } from 'react';
import { Bell, Settings } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ProfileEditor from '@/components/admin/settings/ProfileEditor';
import TeamMemberManager from '@/components/admin/settings/TeamMemberManager';
import NotificationSection from '@/components/admin/settings/NotificationSection';
import WebhookManager from '@/components/admin/settings/WebhookManager';
import ApiKeyManager from '@/components/admin/settings/ApiKeyManager';
import { type TeamMember } from '@/lib/supabase';
import {
  NOTIFICATION_OPTIONS,
} from '@/components/admin/settings/settings-config';

export default function SettingsPage() {
  return (
    <AdminLayout>
      {(auth) => <SettingsContent auth={auth} />}
    </AdminLayout>
  );
}

function SettingsContent({ auth }: {
  auth: {
    teamMember: TeamMember | null;
    companyId: string | null;
    isSuperAdmin: boolean;
    signOut: () => Promise<void>;
    updatePreferences: (prefs: Partial<TeamMember>) => Promise<{ error: unknown } | undefined>;
  };
}) {
  const { teamMember, companyId, isSuperAdmin, updatePreferences } = auth;
  const [saving, setSaving] = useState<string | null>(null);
  const isAdminOrOwner = teamMember?.role === 'owner' || teamMember?.role === 'admin';
  const canManageTeam = isSuperAdmin || isAdminOrOwner;

  const handleToggle = async (key: string) => {
    if (!teamMember) return;
    setSaving(key);
    await updatePreferences({ [key]: !(teamMember as Record<string, unknown>)[key] } as Partial<TeamMember>);
    setSaving(null);
  };

  return (
    <div className="px-6 lg:px-10 py-8 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-teal-tint rounded-[14px] flex items-center justify-center">
          <Settings size={20} className="text-teal" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">Settings</h1>
          <p className="text-sm text-faint">
            Signed in as <span className="text-muted">{teamMember?.email}</span>
          </p>
        </div>
      </div>

      {/* Profile */}
      <ProfileEditor
        memberId={teamMember?.id || ''}
        companyId={companyId || ''}
        name={teamMember?.name || ''}
        avatarPath={(teamMember as Record<string, unknown>)?.avatar_path as string || ''}
        onSave={(updates) => updatePreferences(updates as Partial<TeamMember>)}
      />

      {/* Team Profiles (admin/owner/super admin only) */}
      {canManageTeam && companyId && teamMember && (
        <TeamMemberManager
          companyId={companyId}
          currentMemberId={teamMember.id}
          currentRole={teamMember.role}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Notifications */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center">
            <Bell size={16} className="text-teal" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Notifications</h2>
            <p className="text-xs text-faint">Email alerts for events across your workspace</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 max-w-lg">
          <NotificationSection
            title="Proposals"
            options={NOTIFICATION_OPTIONS}
            teamMember={teamMember}
            saving={saving}
            onToggle={handleToggle}
          />
        </div>

        <p className="mt-4 max-w-lg text-xs text-faint">
          Feedback project notifications are now controlled per-project. Open a project &rarr; Settings tab to manage who&apos;s assigned.
        </p>
      </div>

      {/* Webhooks */}
      {isAdminOrOwner && companyId && (
        <WebhookManager companyId={companyId} isSuperAdmin={isSuperAdmin} />
      )}

      {/* API Keys */}
      {isAdminOrOwner && <ApiKeyManager />}
    </div>
  );
}
