// app/settings/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Settings, Building2, Users, Code2, CreditCard, KeyRound, Plug,
  Webhook, Key, AppWindow, Mail,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import BusinessDetailsCard from '@/components/admin/company/BusinessDetailsCard';
import CompanyProfileCard from '@/components/admin/company/CompanyProfileCard';
import WebhookManager from '@/components/admin/settings/WebhookManager';
import { WEBHOOK_EVENTS, REVIEW_WEBHOOK_EVENTS } from '@/components/admin/settings/settings-config';
import ApiKeyManager from '@/components/admin/settings/ApiKeyManager';
import ConnectedAppsManager from '@/components/admin/settings/ConnectedAppsManager';
import GhlConnectorCard from '@/components/admin/connectors/GhlConnectorCard';
import MetaConnectorCard from '@/components/admin/connectors/MetaConnectorCard';
import MembersTab from '@/components/admin/settings/MembersTab';
import BillingTab from '@/components/admin/settings/BillingTab';
import RolesTab from '@/components/admin/settings/RolesTab';
import ActivityTab from '@/components/admin/settings/ActivityTab';
import { type TeamMember } from '@/lib/supabase';

type TabKey = 'profile' | 'members' | 'roles' | 'billing' | 'integrations' | 'developer' | 'activity';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof Building2;
  description: string;
}

const TABS: TabDef[] = [
  { key: 'profile',      label: 'Company',      icon: Building2,   description: 'Company profile and business details' },
  { key: 'members',      label: 'Members',      icon: Users,       description: 'Team, notifications, and invites' },
  { key: 'roles',        label: 'Roles',        icon: KeyRound,    description: 'What each role can do' },
  { key: 'billing',      label: 'Billing',      icon: CreditCard,  description: 'Plan, payment, invoices' },
  { key: 'integrations', label: 'Integrations', icon: Plug,        description: 'Connect third-party services' },
  { key: 'developer',    label: 'Developer',    icon: Code2,       description: 'API keys, webhooks, and OAuth apps' },
  { key: 'activity',     label: 'Activity',     icon: Mail,        description: 'Email send log and delivery tracking' },
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
  const { teamMember, companyId, isSuperAdmin, accountType } = auth;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = (searchParams.get('tab') as TabKey) || 'profile';
  const [activeTab, setActiveTab] = useState<TabKey>(
    TABS.some(t => t.key === initialTab) ? initialTab : 'profile'
  );

  const setTab = (key: TabKey) => {
    setActiveTab(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null;
    if (t && TABS.some(d => d.key === t) && t !== activeTab) {
      setActiveTab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const isAdminOrOwner = teamMember?.role === 'owner' || teamMember?.role === 'admin';
  const canSeeDeveloper = isSuperAdmin || isAdminOrOwner;
  const canSeeBilling = isAdminOrOwner && accountType === 'agency';

  return (
    <div className="px-6 lg:px-10 py-8">
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
              if ((tab.key === 'developer' || tab.key === 'integrations' || tab.key === 'activity') && !canSeeDeveloper) return null;
              if (tab.key === 'billing' && !canSeeBilling) return null;
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
          {activeTab === 'profile' && companyId && (
            <section className="space-y-8">
              <div>
                <CompanyProfileCard
                  companyId={companyId}
                  isOwner={isAdminOrOwner || isSuperAdmin}
                />
              </div>
              <div>
                <BusinessDetailsCard
                  companyId={companyId}
                  isOwner={isAdminOrOwner || isSuperAdmin}
                />
              </div>
            </section>
          )}

          {activeTab === 'members' && companyId && teamMember && (
            <section>
              <SectionHeader
                title="Members & Notifications"
                description="Manage team access and per-member campaign notification defaults. Expand a member to configure their notifications."
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

          {activeTab === 'roles' && (
            <section>
              <RolesTab currentRole={teamMember?.role} />
            </section>
          )}

          {activeTab === 'billing' && canSeeBilling && companyId && (
            <section>
              <SectionHeader
                title="Billing"
                description="Manage your plan, payment method, and invoices."
              />
              <BillingTab
                companyId={companyId}
                role={teamMember?.role ?? 'member'}
              />
            </section>
          )}

          {/* ── Integrations tab ───────────────────────────────────── */}
          {activeTab === 'integrations' && canSeeDeveloper && companyId && (
            <section>
              <SectionHeader
                title="Integrations"
                description="Connect third-party platforms to sync data and automate workflows."
              />
              <div className="space-y-6">
                <GhlConnectorCard />
                <MetaConnectorCard />
              </div>
            </section>
          )}

          {/* ── Activity tab ───────────────────────────────────────── */}
          {activeTab === 'activity' && canSeeDeveloper && companyId && (
            <section>
              <SectionHeader
                title="Agency Activity"
                description="Full log of every outbound email with delivery and open tracking."
              />
              <ActivityTab companyId={companyId} />
            </section>
          )}

          {/* ── Developer tab ──────────────────────────────────────── */}
          {activeTab === 'developer' && canSeeDeveloper && companyId && (
            <section>
              <SectionHeader
                title="Developer"
                description="Tools for building on the AgencyViz platform — API access, event webhooks, and authorized apps."
              />

              <div className="space-y-8">
                {/* API Keys */}
                <DeveloperSection
                  icon={Key}
                  title="API Keys"
                  description="Generate access tokens for external integrations. Each key is scoped to your workspace and can be revoked at any time."
                >
                  <ApiKeyManager />
                </DeveloperSection>

                {/* Pitch Webhooks */}
                <DeveloperSection
                  icon={Webhook}
                  title="Pitch Webhooks"
                  description="Receive real-time HTTP POST notifications when proposals or quotes change status."
                >
                  <WebhookManager companyId={companyId} events={WEBHOOK_EVENTS} />
                </DeveloperSection>

                {/* Markup Webhooks */}
                {isSuperAdmin && (
                  <DeveloperSection
                    icon={Webhook}
                    title="Campaign Webhooks"
                    description="Receive notifications when campaign assets are commented on, approved, or updated."
                  >
                    <WebhookManager companyId={companyId} events={REVIEW_WEBHOOK_EVENTS} />
                  </DeveloperSection>
                )}

                {/* Connected Apps */}
                <DeveloperSection
                  icon={AppWindow}
                  title="Connected Apps"
                  description="Apps authorized to access your workspace via OAuth — browser extensions, Looker Studio, and other tools."
                >
                  <ConnectedAppsManager />
                </DeveloperSection>
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

function DeveloperSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Key;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-edge">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-wash flex items-center justify-center">
            <Icon size={16} className="text-muted" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="text-xs text-faint">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}
