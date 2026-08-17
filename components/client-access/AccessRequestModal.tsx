'use client';

import { useState } from 'react';
import { X, Send, Copy, Check, Link2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import {
  META_ASSETS, GOOGLE_ASSETS,
  defaultPlatformConfig,
  type PlatformConfig, type AssetDefinition,
} from '@/lib/client-access/platform-config';

interface AccessRequestModalProps {
  clientId?: string;
  clientName?: string;
  onClose: () => void;
  onCreated: () => void;
}

type ModalStep = 'form' | 'success';

export default function AccessRequestModal({
  clientId,
  clientName,
  onClose,
  onCreated,
}: AccessRequestModalProps) {
  const [step, setStep] = useState<ModalStep>('form');
  const [recipientName, setRecipientName] = useState(clientName || '');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [requestName, setRequestName] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(defaultPlatformConfig());
  const [wordpressEnabled, setWordpressEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          notes: notes.trim() || undefined,
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
          notes: notes.trim() || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface border border-edge shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge sticky top-0 bg-surface z-10">
          <h2 className="text-base font-semibold text-ink">
            {step === 'form' ? 'Create Request Link' : 'Your access request link has been created!'}
          </h2>
          <button onClick={step === 'form' ? onClose : () => onCreated()} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Request name */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Request Name (Optional)</label>
              <input
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="Enter a name for your link"
                className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
              <p className="text-[11px] text-dim mt-1">A descriptive name can help you identify the link later.</p>
            </div>

            {/* Client details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Client Name</label>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Client Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
            </div>

            {/* Google Assets */}
            <PlatformAssetSection
              title="Google Account"
              icon={<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
              assets={GOOGLE_ASSETS}
              values={platformConfig.google as Record<string, { enabled: boolean; role: string | null }>}
              onChange={(key, field, val) => updateAsset('google', key, field, val)}
            />

            {/* Meta Assets */}
            <PlatformAssetSection
              title="Meta Account"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" fill="#0866FF"/></svg>}
              assets={META_ASSETS}
              values={platformConfig.meta as Record<string, { enabled: boolean; role: string | null }>}
              onChange={(key, field, val) => updateAsset('meta', key, field, val)}
            />

            {/* WordPress */}
            <div className="border border-edge rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-hover/30 border-b border-edge">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#21759B"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.433 12c0-1.198.258-2.335.714-3.363L8.07 20.238A8.576 8.576 0 0 1 3.433 12zm8.567 8.567c-.874 0-1.716-.138-2.508-.391l2.662-7.737 2.727 7.473c.018.044.04.084.063.123a8.534 8.534 0 0 1-2.944.532z"/></svg>
                </div>
                <h4 className="text-sm font-semibold text-ink">WordPress</h4>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={wordpressEnabled}
                      onChange={(e) => setWordpressEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-teal transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                  <span className="text-sm text-ink flex-1">WordPress Admin Access</span>
                  <span className="text-xs text-dim">Manual setup</span>
                </div>
              </div>
            </div>

            {/* Options row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Link expires in</label>
                <div className="relative">
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Message (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional message..."
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button type="submit" variant="primary" fullWidth loading={sending}>
              Create Request
            </Button>
          </form>
        )}

        {step === 'success' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Copy and paste link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink font-mono truncate focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={copied ? Check : Copy}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
              <p className="text-[11px] text-dim mt-1">Simply copy the access request link and share it with your client.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Send request via email</label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder-dim focus:outline-none"
                />
                {emailSent ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium px-3 py-2.5">
                    <Check size={14} /> Sent
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={Send}
                    onClick={handleSendEmail}
                    loading={sendingEmail}
                    disabled={!recipientEmail.trim()}
                  >
                    Send by email
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-dim mt-1">The access request link will be sent in an email, and you&apos;ll be cc&apos;ed.</p>
            </div>

            <Button variant="primary" fullWidth onClick={() => onCreated()}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformAssetSection({ title, icon, assets, values, onChange }: {
  title: string;
  icon: React.ReactNode;
  assets: AssetDefinition[];
  values: Record<string, { enabled: boolean; role: string | null }>;
  onChange: (key: string, field: 'enabled' | 'role', value: boolean | string | null) => void;
}) {
  return (
    <div className="border border-edge rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-hover/30 border-b border-edge">
        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">{icon}</div>
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
      </div>
      <div className="p-3 space-y-2">
        {assets.map((asset) => {
          const val = values[asset.key] || { enabled: false, role: null };
          return (
            <div key={asset.key} className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={val.enabled}
                  onChange={(e) => onChange(asset.key, 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-teal transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <span className="text-sm text-ink flex-1 min-w-0">{asset.label}</span>
              <div className="relative shrink-0">
                <select
                  value={val.role || ''}
                  onChange={(e) => onChange(asset.key, 'role', e.target.value || null)}
                  disabled={!val.enabled}
                  className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-surface border border-edge text-xs text-ink focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed min-w-[110px]"
                >
                  <option value="">Select Role</option>
                  {asset.roles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
