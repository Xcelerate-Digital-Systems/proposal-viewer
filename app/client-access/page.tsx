'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, Copy, Check, Plus, Settings2, Link2, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import AdminLayout from '@/components/admin/AdminLayout';
import AccessRequestWizard from '@/components/client-access/AccessRequestWizard';
import AccessRequestList from '@/components/client-access/AccessRequestList';
import AgencyAccessConfigForm from '@/components/client-access/AgencyAccessConfigForm';
import { authFetch } from '@/lib/auth-fetch';

type TabKey = 'requests' | 'settings';
type ViewMode = 'list' | 'create';

export default function ClientAccessPage() {
  return (
    <AdminLayout>
      {({ companyId, isAgencyAdmin }) => {
        if (!companyId) return null;
        return <ClientAccessContent companyId={companyId} isAgencyAdmin={isAgencyAdmin} />;
      }}
    </AdminLayout>
  );
}

function ClientAccessContent({
  companyId,
  isAgencyAdmin,
}: {
  companyId: string;
  isAgencyAdmin: boolean;
}) {
  const initialTab = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'settings' ? 'settings' : 'requests';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [refreshKey, setRefreshKey] = useState(0);
  const [universalToken, setUniversalToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await authFetch('/api/agency-access-config');
      if (res.ok) {
        const data = await res.json();
        setUniversalToken(data.universal_share_token ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const universalUrl = universalToken
    ? `${window.location.origin}/access/${universalToken}`
    : null;

  const handleCopyUniversal = async () => {
    if (!universalUrl) return;
    await navigator.clipboard.writeText(universalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { key: TabKey; label: string; icon: typeof KeyRound }[] = [
    { key: 'requests', label: 'Access Requests', icon: KeyRound },
    { key: 'settings', label: 'Settings', icon: Settings2 },
  ];

  // Show wizard when creating
  if (viewMode === 'create') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AccessRequestWizard
          onBack={() => setViewMode('list')}
          onCreated={() => {
            setViewMode('list');
            setRefreshKey((k) => k + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <PageHeader
        title="Client Access"
        description="Send clients a link to grant your agency access to their ad accounts, analytics, and more."
      />

      {/* Universal link card */}
      {!loadingConfig && universalUrl && (
        <div className="mt-6 bg-surface border border-edge rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
              <Link2 size={18} className="text-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-ink">Universal Link</h3>
              <p className="text-xs text-muted mt-0.5">
                Share this link with any client. They&apos;ll enter their details and connect their accounts.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <input
                  readOnly
                  value={universalUrl}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-edge text-sm text-ink font-mono truncate focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={copied ? Check : Copy}
                  onClick={handleCopyUniversal}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  leftIcon={ExternalLink}
                  onClick={() => window.open(universalUrl, '_blank')}
                  aria-label="Open universal link"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mt-6 border-b border-edge">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-teal text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
        {activeTab === 'requests' && (
          <div className="ml-auto pb-2">
            <Button size="sm" leftIcon={Plus} onClick={() => setViewMode('create')}>
              New Request
            </Button>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'requests' && (
          <AccessRequestList refreshKey={refreshKey} />
        )}

        {activeTab === 'settings' && (
          <div className="bg-surface border border-edge rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-ink mb-1">Platform Configuration</h3>
            <p className="text-xs text-muted mb-5">
              Configure your agency&apos;s platform credentials so client access grants work automatically.
            </p>
            <AgencyAccessConfigForm />
          </div>
        )}
      </div>
    </div>
  );
}
