'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ChevronDown, ChevronUp, Copy, Check, Send,
  Link2, ExternalLink, Loader2, RefreshCw, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import {
  META_ASSETS, GOOGLE_ASSETS,
  defaultPlatformConfig,
  type PlatformConfig, type AssetDefinition,
} from '@/lib/client-access/platform-config';

interface AccessRequestWizardProps {
  clientId?: string;
  clientName?: string;
  onBack: () => void;
  onCreated: () => void;
}

interface AgencyConfig {
  meta_business_id: string | null;
  meta_business_name: string | null;
  meta_user_id: string | null;
  meta_user_name: string | null;
  google_mcc_id: string | null;
  google_mcc_name: string | null;
  google_analytics_email: string | null;
  google_user_name: string | null;
  wordpress_admin_email: string | null;
  universal_share_token: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

type WizardStep = 'details' | 'platforms' | 'success';

export default function AccessRequestWizard({
  clientId,
  clientName: initialClientName,
  onBack,
  onCreated,
}: AccessRequestWizardProps) {
  const [step, setStep] = useState<WizardStep>('details');

  // Step 1 state
  const [linkType, setLinkType] = useState<'single' | 'reusable'>('single');
  const [requestName, setRequestName] = useState('');
  const [recipientName, setRecipientName] = useState(initialClientName || '');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);

  // Step 2 state
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(defaultPlatformConfig());
  const [wordpressEnabled, setWordpressEnabled] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>('google');

  // Agency config
  const [agencyConfig, setAgencyConfig] = useState<AgencyConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Meta Business Manager
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  // Team members (for Select Users)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Submit state
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Load agency config + team members
  useEffect(() => {
    authFetch('/api/agency-access-config')
      .then((res) => res.json())
      .then((data) => setAgencyConfig(data))
      .catch(() => {})
      .finally(() => setLoadingConfig(false));

    authFetch('/api/team')
      .then((res) => res.json())
      .then((data) => {
        const members = data.members || [];
        setTeamMembers(members);
        if (members.length > 0) setSelectedUserId(members[0].id);
      })
      .catch(() => {});
  }, []);

  // Load Meta businesses when config is available
  const fetchBusinesses = useCallback(async () => {
    if (!agencyConfig?.meta_user_id) return;
    setLoadingBusinesses(true);
    try {
      const res = await authFetch('/api/agency-access-config/meta/businesses');
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.businesses || []);
      }
    } catch { /* ignore */ }
    finally { setLoadingBusinesses(false); }
  }, [agencyConfig?.meta_user_id]);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  const metaConnected = !!agencyConfig?.meta_user_id;
  const googleConnected = !!agencyConfig?.google_analytics_email;

  const updateAsset = (platformKey: 'meta' | 'google', assetKey: string, field: 'enabled' | 'role', value: boolean | string | null) => {
    setPlatformConfig((prev) => {
      const pc = JSON.parse(JSON.stringify(prev)) as PlatformConfig;
      const assets = pc[platformKey] as Record<string, { enabled: boolean; role: string | null }>;
      assets[assetKey] = { ...assets[assetKey], [field]: value };
      if (field === 'enabled' && !value) assets[assetKey].role = null;
      return pc;
    });
  };

  const getEnabledPlatforms = (): string[] => {
    const platforms: string[] = [];
    const metaAssets = platformConfig.meta as Record<string, { enabled: boolean }>;
    const googleAssets = platformConfig.google as Record<string, { enabled: boolean }>;
    if (Object.values(metaAssets).some((a) => a.enabled)) platforms.push('meta');
    if (googleAssets.google_ads?.enabled) platforms.push('google_ads');
    if (googleAssets.google_analytics?.enabled) platforms.push('google_ga4');
    if (googleAssets.google_tag_manager?.enabled) platforms.push('google_gtm');
    if (googleAssets.google_business_profile?.enabled) platforms.push('google_gbp');
    if (googleAssets.google_search_console?.enabled) platforms.push('google_search_console');
    if (googleAssets.google_merchant_center?.enabled) platforms.push('google_merchant_center');
    if (wordpressEnabled) platforms.push('wordpress');
    return platforms;
  };

  const handleSubmit = async () => {
    const platforms = getEnabledPlatforms();
    if (platforms.length === 0) {
      setError('Enable at least one asset');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await authFetch('/api/client-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || undefined,
          platforms,
          platform_config: platformConfig,
          client_name: recipientName.trim() || requestName.trim() || undefined,
          client_email: recipientEmail.trim() || undefined,
          notes: undefined,
          expires_in_days: expiresInDays,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to create access request');
        return;
      }

      const data = await res.json();
      const url = `${window.location.origin}/access/${data.share_token}`;
      setShareUrl(url);
      setStep('success');
    } catch {
      setError('Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) return;
    setSendingEmail(true);
    try {
      const res = await authFetch('/api/client-access/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_url: shareUrl,
          client_email: recipientEmail.trim(),
          client_name: recipientName.trim() || null,
          notes: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to send email');
        return;
      }
      setEmailSent(true);
    } catch {
      setError('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleConnect = (platform: 'meta' | 'google') => {
    authFetch(`/api/agency-access-config/${platform}`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return;
        const { authorize_url } = await res.json();
        window.location.href = authorize_url;
      })
      .catch(() => {});
  };

  // ==================== Step 1: Details ====================
  if (step === 'details') {
    return (
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-6">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="max-w-xl">
          <h2 className="text-lg font-bold text-ink mb-1">Create Request Link</h2>
          <p className="text-sm text-muted mb-6">Choose the type of link and enter your client&apos;s details.</p>

          <div className="bg-surface border border-edge rounded-2xl p-6 space-y-6">
            {/* Link type */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-3">Link Type</label>
              <div className="space-y-2">
                <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${linkType === 'single' ? 'border-primary bg-primary-tint/30' : 'border-edge hover:border-muted'}`}>
                  <input type="radio" name="linkType" value="single" checked={linkType === 'single'} onChange={() => setLinkType('single')} className="mt-0.5 accent-primary" />
                  <div>
                    <span className="text-sm font-semibold text-ink">Single-Use Link</span>
                    <p className="text-xs text-muted mt-0.5">This link can be used once by one client.</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${linkType === 'reusable' ? 'border-primary bg-primary-tint/30' : 'border-edge hover:border-muted'}`}>
                  <input type="radio" name="linkType" value="reusable" checked={linkType === 'reusable'} onChange={() => setLinkType('reusable')} className="mt-0.5 accent-primary" />
                  <div>
                    <span className="text-sm font-semibold text-ink">Reusable Link</span>
                    <p className="text-xs text-muted mt-0.5">This link can be used multiple times by multiple clients.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Request name */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Request Name (Optional)</label>
              <input
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="Enter a name for your link"
                className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-dim mt-1">A descriptive name can help you identify the link later.</p>
            </div>

            {/* Client details — only for single-use */}
            {linkType === 'single' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Client Name</label>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Client Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            {/* Expiry */}
            <div className="max-w-[200px]">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Link Expires In</label>
              <div className="relative">
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <Button variant="primary" onClick={() => setStep('platforms')}>Next</Button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== Step 2: Platforms ====================
  if (step === 'platforms') {
    const toggleAccordion = (key: string) => {
      setExpandedPlatform(expandedPlatform === key ? null : key);
    };

    return (
      <div>
        <button onClick={() => setStep('details')} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-6">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="mb-1">
          <span className="text-xs font-medium text-muted">{linkType === 'single' ? 'Single-Use Link' : 'Reusable Link'}</span>
          {requestName && <h2 className="text-lg font-bold text-ink">{requestName}</h2>}
        </div>
        <p className="text-sm font-semibold text-ink mt-2 mb-5">Select below the accounts you want to request access for</p>

        {loadingConfig ? (
          <div className="flex items-center gap-2 text-sm text-dim py-8">
            <Loader2 size={16} className="animate-spin" /> Loading platform configuration…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google Account */}
            <PlatformSection
              title="Google Account"
              icon={<GoogleIcon />}
              expanded={expandedPlatform === 'google'}
              onToggle={() => toggleAccordion('google')}
              connectedEmail={agencyConfig?.google_analytics_email || null}
              connectedName={agencyConfig?.google_user_name || null}
              onConnect={() => handleConnect('google')}
              onRefresh={() => handleConnect('google')}
              isConnected={googleConnected}
            >
              <div>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">Select Assets</p>
                <div>
                  {GOOGLE_ASSETS.map((asset) => {
                    const val = (platformConfig.google as Record<string, { enabled: boolean; role: string | null }>)[asset.key] || { enabled: false, role: null };
                    return (
                      <AssetRow
                        key={asset.key}
                        asset={asset}
                        enabled={val.enabled}
                        role={val.role}
                        onToggle={(v) => updateAsset('google', asset.key, 'enabled', v)}
                        onRoleChange={(v) => updateAsset('google', asset.key, 'role', v)}
                      />
                    );
                  })}
                </div>
              </div>
            </PlatformSection>

            {/* Meta Account */}
            <PlatformSection
              title="Meta Account"
              icon={<MetaIcon />}
              expanded={expandedPlatform === 'meta'}
              onToggle={() => toggleAccordion('meta')}
              connectedEmail={agencyConfig?.meta_user_name || agencyConfig?.meta_user_id || null}
              onConnect={() => handleConnect('meta')}
              onRefresh={() => handleConnect('meta')}
              isConnected={metaConnected}
            >
              <div>
                {/* Business Manager selector */}
                {metaConnected && (
                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-sm font-medium text-muted">Select Business Manager</p>
                      <HelpCircle size={13} className="text-dim" />
                    </div>
                    {loadingBusinesses ? (
                      <div className="flex items-center gap-2 text-xs text-dim py-1">
                        <Loader2 size={14} className="animate-spin" /> Loading…
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={agencyConfig?.meta_business_id || ''}
                          onChange={() => {}}
                          className="w-full appearance-none px-4 py-3 pr-8 rounded-xl bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">-Select-</option>
                          {businesses.map((bm) => (
                            <option key={bm.id} value={bm.id}>{bm.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      </div>
                    )}
                  </div>
                )}

                {/* Select Users */}
                {metaConnected && teamMembers.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-sm font-medium text-muted">Select Users</p>
                      <HelpCircle size={13} className="text-dim" />
                    </div>
                    <div className="relative">
                      <select
                        value={selectedUserId || ''}
                        onChange={(e) => setSelectedUserId(e.target.value || null)}
                        className="w-full appearance-none px-4 py-3 pr-8 rounded-xl bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name || m.email}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    </div>
                  </div>
                )}

                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">Select Assets</p>
                <div>
                  {META_ASSETS.map((asset) => {
                    const val = (platformConfig.meta as Record<string, { enabled: boolean; role: string | null }>)[asset.key] || { enabled: false, role: null };
                    return (
                      <AssetRow
                        key={asset.key}
                        asset={asset}
                        enabled={val.enabled}
                        role={val.role}
                        onToggle={(v) => updateAsset('meta', asset.key, 'enabled', v)}
                        onRoleChange={(v) => updateAsset('meta', asset.key, 'role', v)}
                      />
                    );
                  })}
                </div>
              </div>
            </PlatformSection>

            {/* WordPress */}
            <div className="border border-edge rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleAccordion('wordpress')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <WordPressIcon />
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-ink">WordPress</h4>
                    {agencyConfig?.wordpress_admin_email && (
                      <p className="text-xs text-muted mt-0.5">{agencyConfig.wordpress_admin_email}</p>
                    )}
                  </div>
                </div>
                {expandedPlatform === 'wordpress' ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
              </button>
              {expandedPlatform === 'wordpress' && (
                <div className="px-5 pb-4 border-t border-edge pt-4">
                  <div className="flex items-center gap-3 py-2">
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" checked={wordpressEnabled} onChange={(e) => setWordpressEnabled(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                    <span className="text-sm text-ink">WordPress Admin Access</span>
                    <span className="text-xs text-dim ml-auto">Manual setup</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-4">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-8">
          <Button variant="secondary" onClick={() => setStep('details')}>Back</Button>
          <Button variant="primary" onClick={handleSubmit} loading={sending}>Create Request</Button>
        </div>
      </div>
    );
  }

  // ==================== Step 3: Success ====================
  return (
    <div>
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">Your access request link has been created!</h2>
            <p className="text-sm text-muted">Share this link with your client to request access to their accounts.</p>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-2xl p-6 space-y-5">
          {/* Copy link */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Copy and paste link</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-edge text-sm text-ink font-mono truncate focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button variant="primary" size="sm" leftIcon={copied ? Check : Copy} onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
            <p className="text-[11px] text-dim mt-1">Simply copy the access request link and share it with your client.</p>
          </div>

          {/* Send via email */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Send request via email</label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@email.com"
                className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-edge text-sm text-ink placeholder-dim focus:outline-none"
              />
              {emailSent ? (
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium px-3 py-2.5">
                  <Check size={14} /> Sent
                </div>
              ) : (
                <Button variant="secondary" size="sm" leftIcon={Send} onClick={handleSendEmail} loading={sendingEmail} disabled={!recipientEmail.trim()}>
                  Send by email
                </Button>
              )}
            </div>
            <p className="text-[11px] text-dim mt-1">The access request link will be sent in an email, and you&apos;ll be cc&apos;ed.</p>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="primary" onClick={onCreated}>Done</Button>
        </div>
      </div>
    </div>
  );
}

/* ==================== Sub-components ==================== */

function PlatformSection({
  title,
  icon,
  expanded,
  onToggle,
  connectedEmail,
  connectedName,
  onConnect,
  onRefresh,
  isConnected,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  connectedEmail: string | null;
  connectedName?: string | null;
  onConnect: () => void;
  onRefresh: () => void;
  isConnected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-edge rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
        </div>
        {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-edge pt-4">
          {isConnected ? (
            <>
              <div className="mb-4">
                <p className="text-sm text-ink">{connectedEmail}{connectedName ? ` · ${connectedName}` : ''}</p>
                <p className="text-xs text-muted mt-0.5">
                  Renew your access by re-connecting.{' '}
                  <button onClick={onRefresh} className="text-primary hover:underline font-medium">Click here to refresh</button>
                </p>
              </div>
              {children}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted mb-3">Connect your {title.toLowerCase()} to configure assets.</p>
              <Button variant="primary" size="sm" leftIcon={Link2} onClick={onConnect}>
                Connect {title}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  enabled,
  role,
  onToggle,
  onRoleChange,
}: {
  asset: AssetDefinition;
  enabled: boolean;
  role: string | null;
  onToggle: (v: boolean) => void;
  onRoleChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="sr-only peer" />
        <div className="w-10 h-[22px] bg-gray-200 rounded-full peer peer-checked:bg-[#4CAF93] transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[18px]" />
      </label>
      <span className="text-sm text-ink flex-1 min-w-0">{asset.label}</span>
      <div className="relative shrink-0">
        <select
          value={role || ''}
          onChange={(e) => onRoleChange(e.target.value || null)}
          disabled={!enabled}
          className="appearance-none px-4 py-2.5 pr-8 rounded-xl bg-surface border border-edge text-sm text-ink focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px]"
        >
          <option value="">Select Role</option>
          {asset.roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      </div>
    </div>
  );
}

/* ==================== Icons ==================== */

function GoogleIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    </div>
  );
}

function MetaIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" fill="#0866FF"/>
      </svg>
    </div>
  );
}

function WordPressIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#21759B">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.433 12c0-1.198.258-2.335.714-3.363L8.07 20.238A8.576 8.576 0 0 1 3.433 12zm8.567 8.567c-.874 0-1.716-.138-2.508-.391l2.662-7.737 2.727 7.473c.018.044.04.084.063.123a8.534 8.534 0 0 1-2.944.532z"/>
      </svg>
    </div>
  );
}
