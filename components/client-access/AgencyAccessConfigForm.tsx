'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link2, Unlink, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';

interface MetaBusiness {
  id: string;
  name: string;
}

interface ConfigData {
  meta_business_id: string | null;
  meta_business_name: string | null;
  meta_user_id: string | null;
  meta_user_name: string | null;
  google_mcc_id: string | null;
  google_analytics_email: string | null;
  google_user_name: string | null;
  wordpress_admin_email: string;
}

export default function AgencyAccessConfigForm() {
  const [config, setConfig] = useState<ConfigData>({
    meta_business_id: null,
    meta_business_name: null,
    meta_user_id: null,
    meta_user_name: null,
    google_mcc_id: null,
    google_analytics_email: null,
    google_user_name: null,
    wordpress_admin_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businesses, setBusinesses] = useState<MetaBusiness[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [savingBm, setSavingBm] = useState(false);

  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/agency-access-config')
      .then((res) => res.json())
      .then((data) => {
        setConfig({
          meta_business_id: data.meta_business_id || null,
          meta_business_name: data.meta_business_name || null,
          meta_user_id: data.meta_user_id || null,
          meta_user_name: data.meta_user_name || null,
          google_mcc_id: data.google_mcc_id || null,
          google_analytics_email: data.google_analytics_email || null,
          google_user_name: data.google_user_name || null,
          wordpress_admin_email: data.wordpress_admin_email || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const metaConnected = !!config.meta_user_id;
  const googleConnected = !!config.google_analytics_email;

  const fetchBusinesses = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      const res = await authFetch('/api/agency-access-config/meta/businesses');
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.businesses || []);
      }
    } catch { /* ignore */ }
    finally { setLoadingBusinesses(false); }
  }, []);

  useEffect(() => {
    if (metaConnected) fetchBusinesses();
  }, [metaConnected, fetchBusinesses]);

  const handleSelectBm = async (bmId: string) => {
    const bm = businesses.find((b) => b.id === bmId);
    if (!bm) return;
    setSavingBm(true);
    try {
      const res = await authFetch('/api/agency-access-config/meta/select-bm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_business_id: bm.id, meta_business_name: bm.name }),
      });
      if (res.ok) {
        setConfig((p) => ({ ...p, meta_business_id: bm.id, meta_business_name: bm.name }));
      }
    } catch { /* ignore */ }
    finally { setSavingBm(false); }
  };

  const handleConnect = async (platform: 'meta' | 'google') => {
    const setter = platform === 'meta' ? setConnectingMeta : setConnectingGoogle;
    setter(true);
    try {
      const res = await authFetch(`/api/agency-access-config/${platform}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed to start ${platform} connection`);
        return;
      }
      const { authorize_url } = await res.json();
      window.location.href = authorize_url;
    } catch {
      setError(`Failed to connect ${platform}`);
      setter(false);
    }
  };

  const handleDisconnect = async (platform: 'meta' | 'google') => {
    setSaving(true);
    const fields = platform === 'meta'
      ? { meta_business_id: null, meta_business_name: null }
      : { google_mcc_id: null, google_mcc_name: null, google_analytics_email: null, google_gtm_email: null };
    try {
      await authFetch('/api/agency-access-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (platform === 'meta') {
        setConfig((p) => ({ ...p, meta_business_id: null, meta_business_name: null, meta_user_id: null, meta_user_name: null }));
        setBusinesses([]);
      } else {
        setConfig((p) => ({ ...p, google_mcc_id: null, google_analytics_email: null, google_user_name: null }));
      }
    } catch { setError('Failed to disconnect'); }
    finally { setSaving(false); }
  };

  const saveWordpress = async () => {
    setSaving(true);
    try {
      await authFetch('/api/agency-access-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordpress_admin_email: config.wordpress_admin_email.trim() || null }),
      });
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-sm text-dim py-4">Loading configuration…</div>;

  const toggleAccordion = (key: string) => {
    setExpandedPlatform(expandedPlatform === key ? null : key);
  };

  return (
    <div className="space-y-4">
      {/* Google Platform Card */}
      <PlatformAccordion
        platform="google"
        label="Google Account"
        icon={<GoogleIcon />}
        connected={googleConnected}
        connectedLabel={googleConnected ? config.google_analytics_email : null}
        userName={config.google_user_name}
        expanded={expandedPlatform === 'google'}
        onToggle={() => toggleAccordion('google')}
        onConnect={() => handleConnect('google')}
        onDisconnect={() => handleDisconnect('google')}
        connecting={connectingGoogle}
        saving={saving}
      >
        {googleConnected && config.google_mcc_id && (
          <div className="px-1">
            <p className="text-xs text-muted mb-1">MCC Account</p>
            <p className="text-sm text-ink font-medium">{config.google_mcc_id}</p>
          </div>
        )}
        {googleConnected && !config.google_mcc_id && (
          <p className="text-xs text-dim px-1">Connected. Select assets and roles when creating request links.</p>
        )}
      </PlatformAccordion>

      {/* Meta Platform Card */}
      <PlatformAccordion
        platform="meta"
        label="Meta Account"
        icon={<MetaIcon />}
        connected={metaConnected}
        connectedLabel={metaConnected ? (config.meta_user_name || config.meta_user_id) : null}
        expanded={expandedPlatform === 'meta'}
        onToggle={() => toggleAccordion('meta')}
        onConnect={() => handleConnect('meta')}
        onDisconnect={() => handleDisconnect('meta')}
        connecting={connectingMeta}
        saving={saving}
      >
        {metaConnected && (
          <div className="px-1">
            <p className="text-xs text-muted mb-1.5">Select Business Manager</p>
            {loadingBusinesses ? (
              <div className="flex items-center gap-2 text-xs text-dim py-1">
                <Loader2 size={14} className="animate-spin" />
                Loading…
              </div>
            ) : businesses.length === 0 ? (
              <p className="text-xs text-dim">No Business Managers found.</p>
            ) : (
              <div className="relative">
                <select
                  value={config.meta_business_id || ''}
                  onChange={(e) => handleSelectBm(e.target.value)}
                  disabled={savingBm}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:opacity-50"
                >
                  <option value="">— Select —</option>
                  {businesses.map((bm) => (
                    <option key={bm.id} value={bm.id}>{bm.name} ({bm.id})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            )}
          </div>
        )}
      </PlatformAccordion>

      {/* WordPress Card */}
      <PlatformAccordion
        platform="wordpress"
        label="WordPress"
        icon={<WordPressIcon />}
        connected={!!config.wordpress_admin_email}
        connectedLabel={config.wordpress_admin_email || null}
        expanded={expandedPlatform === 'wordpress'}
        onToggle={() => toggleAccordion('wordpress')}
      >
        <div className="px-1">
          <p className="text-xs text-muted mb-1.5">Admin email for WordPress access</p>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={config.wordpress_admin_email}
              onChange={(e) => setConfig((p) => ({ ...p, wordpress_admin_email: e.target.value }))}
              placeholder="admin@youragency.com"
              className="flex-1 px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
            <Button variant="primary" size="sm" onClick={saveWordpress} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </PlatformAccordion>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  );
}

/* --- Sub-components --- */

function PlatformAccordion({
  platform,
  label,
  icon,
  connected,
  connectedLabel,
  userName,
  expanded,
  onToggle,
  onConnect,
  onDisconnect,
  connecting,
  saving,
  children,
}: {
  platform: string;
  label: string;
  icon: React.ReactNode;
  connected: boolean;
  connectedLabel?: string | null;
  userName?: string | null;
  expanded: boolean;
  onToggle: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connecting?: boolean;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-edge rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <h4 className="text-sm font-semibold text-ink">{label}</h4>
            {connected && connectedLabel && (
              <p className="text-xs text-muted mt-0.5">{connectedLabel}{userName ? ` · ${userName}` : ''}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && <CheckCircle2 size={16} className="text-emerald-500" />}
          {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-edge pt-4">
          {onConnect && !connected && (
            <Button variant="primary" size="sm" leftIcon={Link2} onClick={onConnect} loading={connecting} className="mb-4">
              Connect {label}
            </Button>
          )}
          {connected && onDisconnect && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-emerald-600 font-medium">Connected</span>
              <span className="text-xs text-dim">·</span>
              <button onClick={onDisconnect} className="text-xs text-muted hover:text-red-500 transition-colors flex items-center gap-1" disabled={saving}>
                <Unlink size={12} /> Disconnect
              </button>
            </div>
          )}
          {(platform !== 'wordpress' || connected || !onConnect) && children}
        </div>
      )}
    </div>
  );
}

function MetaIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" fill="#0866FF"/>
      </svg>
    </div>
  );
}

function GoogleIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#4285F4]/10 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    </div>
  );
}

function WordPressIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#21759B]/10 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#21759B">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.433 12c0-1.198.258-2.335.714-3.363L8.07 20.238A8.576 8.576 0 0 1 3.433 12zm8.567 8.567c-.874 0-1.716-.138-2.508-.391l2.662-7.737 2.727 7.473c.018.044.04.084.063.123a8.534 8.534 0 0 1-2.944.532zm1.201-12.594c.534-.028 1.015-.084 1.015-.084.478-.056.422-.757-.056-.729 0 0-1.435.113-2.361.113-.877 0-2.353-.113-2.353-.113-.478-.028-.534.701-.056.729 0 0 .452.056.93.084L11.47 11.5l-2.01 6.03-3.351-9.958c.534-.028 1.015-.084 1.015-.084.478-.056.422-.757-.056-.729 0 0-1.435.113-2.361.113-.166 0-.362-.004-.567-.011A8.552 8.552 0 0 1 12 3.433c2.143 0 4.097.788 5.595 2.088-.036-.002-.07-.008-.107-.008-1.237 0-2.115 1.079-2.115 2.241 0 .729.422 1.346.87 2.075.337.591.73 1.346.73 2.437 0 .757-.29 1.633-.673 2.858l-.882 2.943-3.19-9.494z"/>
      </svg>
    </div>
  );
}
