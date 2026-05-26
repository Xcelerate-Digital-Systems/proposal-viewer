// app/settings/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Settings, UserCircle2, Bell, Users, Code2,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ProfileEditor from '@/components/admin/settings/ProfileEditor';
import NotificationSection from '@/components/admin/settings/NotificationSection';
import WebhookManager from '@/components/admin/settings/WebhookManager';
import ApiKeyManager from '@/components/admin/settings/ApiKeyManager';
import ConnectedAppsManager from '@/components/admin/settings/ConnectedAppsManager';
import MembersTab from '@/components/admin/settings/MembersTab';
import { type TeamMember } from '@/lib/supabase';
import { NOTIFICATION_OPTIONS } from '@/components/admin/settings/settings-config';

type TabKey = 'profile' | 'notifications' | 'members' | 'developer';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof UserCircle2;
  description: string;
}

const TABS: TabDef[] = [
  { key: 'profile',       label: 'Profile',       icon: UserCircle2, description: 'Your name and photo' },
  { key: 'notifications', label: 'Notifications', icon: Bell,        description: 'Email alerts for events' },
  { key: 'members',       label: 'Members',       icon: Users,       description: 'Team members, roles, and invites' },
  { key: 'developer',     label: 'Developer',     icon: Code2,       description: 'Webhooks and API keys' },
];

export default function SettingsPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <Suspense fallback={<div className="px-6 lg:px-10 py-8 text-sm text-faint">Loading…</div>}>
          <SettingsContent auth={auth} />
        </Suspense>
      )}
    </AdminLayout>
  );
}

function SettingsContent({ auth }: {
  auth: {
    teamMember: TeamMember | null;
    companyId: string | null;
    isSuperAdmin: boolean;
    accountType: 'agency' | 'client';
    signOut: () => Promise<void>;
    updatePreferences: (prefs: Partial<TeamMember>) => Promise<{ error: unknown } | undefined>;
  };
}) {
  const { teamMember, companyId, isSuperAdmin, accountType, updatePreferences } = auth;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = (searchParams.get('tab') as TabKey) || 'profile';
  const [activeTab, setActiveTab] = useState<TabKey>(
    TABS.some(t => t.key === initialTab) ? initialTab : 'profile'
  );

  // Keep URL in sync when the user clicks a tab. Use replace so it doesn't
  // pollute browser history with every tab switch.
  const setTab = (key: TabKey) => {
    setActiveTab(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // React to back/forward navigation that changes the ?tab= param.
  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null;
    if (t && TABS.some(d => d.key === t) && t !== activeTab) {
      setActiveTab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const isAdminOrOwner = teamMember?.role === 'owner' || teamMember?.role === 'admin';
  const canSeeDeveloper = isSuperAdmin || isAdminOrOwner;

  const [savingPref, setSavingPref] = useState<string | null>(null);
  const handleToggle = async (key: string) => {
    if (!teamMember) return;
    setSavingPref(key);
    await updatePreferences({
      [key]: !(teamMember as Record<string, unknown>)[key],
    } as Partial<TeamMember>);
    setSavingPref(null);
  };

  return (
    <div className="px-6 lg:px-10 py-8 max-w-6xl">
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

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <nav className="lg:w-60 shrink-0">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {TABS.map(tab => {
              if (tab.key === 'developer' && !canSeeDeveloper) return null;
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <li key={tab.key}>
                  <button
                    onClick={() => setTab(tab.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left whitespace-nowrap ${
                      active
                        ? 'bg-teal-tint text-teal font-medium'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    }`}
                  >
                    <Icon size={16} className={active ? 'text-teal' : 'text-faint'} />
                    <span>{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && teamMember && (
            <section>
              <SectionHeader
                title="Profile"
                description="How your teammates see you in the app."
              />
              <ProfileEditor
                memberId={teamMember.id}
                companyId={companyId || ''}
                name={teamMember.name || ''}
                avatarPath={(teamMember as Record<string, unknown>).avatar_path as string || ''}
                onSave={(updates) => updatePreferences(updates as Partial<TeamMember>)}
              />
            </section>
          )}

          {activeTab === 'notifications' && (
            <section>
              <SectionHeader
                title="Notifications"
                description="Email alerts for events across your workspace."
              />
              <div className="max-w-lg">
                <NotificationSection
                  title="Proposals"
                  options={NOTIFICATION_OPTIONS}
                  teamMember={teamMember}
                  saving={savingPref}
                  onToggle={handleToggle}
                />
              </div>
              <p className="mt-4 max-w-lg text-xs text-faint">
                Feedback project notifications are now controlled per-project. Open a project &rarr; Settings tab to manage who&apos;s assigned.
              </p>
            </section>
          )}

          {activeTab === 'members' && companyId && teamMember && (
            <section>
              <SectionHeader
                title="Members"
                description="Manage who has access to this workspace and what they can do."
              />
              <MembersTab
                companyId={companyId}
                currentMemberId={teamMember.id}
                currentRole={teamMember.role}
                isSuperAdmin={isSuperAdmin}
                accountType={accountType}
              />
            </section>
          )}

          {activeTab === 'developer' && canSeeDeveloper && companyId && (
            <section className="space-y-10">
              <div>
                <SectionHeader
                  title="Webhooks"
                  description="Send HTTP POST requests when events occur in your workspace."
                />
                <WebhookManager companyId={companyId} isSuperAdmin={isSuperAdmin} />
              </div>
              <div>
                <SectionHeader
                  title="Connected Apps"
                  description="Integrations authorized via OAuth — Chrome extension, Looker Studio connector, and other approved apps."
                />
                <ConnectedAppsManager />
              </div>
              <div>
                <SectionHeader
                  title="API Keys"
                  description="Personal access tokens for the AgencyViz API."
                />
                <ApiKeyManager />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="text-xs text-faint mt-0.5">{description}</p>
    </div>
  );
}
