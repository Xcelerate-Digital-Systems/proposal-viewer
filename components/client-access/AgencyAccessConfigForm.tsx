'use client';

import { useState, useEffect } from 'react';
import { Save, Link2, Unlink, CheckCircle2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import { useSearchParams } from 'next/navigation';

interface ConfigData {
  meta_business_id: string | null;
  meta_business_name: string | null;
  meta_user_name: string | null;
  google_mcc_id: string | null;
  google_mcc_name: string | null;
  google_analytics_email: string | null;
  google_gtm_email: string | null;
  google_user_name: string | null;
  wordpress_admin_email: string;
}

interface MetaBusiness {
  id: string;
  name: string;
}

export default function AgencyAccessConfigForm() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<ConfigData>({
    meta_business_id: null,
    meta_business_name: null,
    meta_user_name: null,
    google_mcc_id: null,
    google_mcc_name: null,
    google_analytics_email: null,
    google_gtm_email: null,
    google_user_name: null,
    wordpress_admin_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [bmPickerOpen, setBmPickerOpen] = useState(false);
  const [availableBusinesses, setAvailableBusinesses] = useState<MetaBusiness[]>([]);
  const [selectingBm, setSelectingBm] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('meta_pick_bm') === '1') {
      const bmParam = searchParams.get('meta_businesses') || '';
      const parsed = bmParam.split('|').filter(Boolean).map((entry) => {
        const colonIdx = entry.indexOf(':');
        return { id: entry.slice(0, colonIdx), name: entry.slice(colonIdx + 1) };
      }).filter((b) => b.id && b.name);
      if (parsed.length > 0) {
        setAvailableBusinesses(parsed);
        setBmPickerOpen(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    authFetch('/api/agency-access-config')
      .then((res) => res.json())
      .then((data) => {
        setConfig({
          meta_business_id: data.meta_business_id || null,
          meta_business_name: data.meta_business_name || null,
          meta_user_name: data.meta_user_name || null,
          google_mcc_id: data.google_mcc_id || null,
          google_mcc_name: data.google_mcc_name || null,
          google_analytics_email: data.google_analytics_email || null,
          google_gtm_email: data.google_gtm_email || null,
          google_user_name: data.google_user_name || null,
          wordpress_admin_email: data.wordpress_admin_email || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectBm = async (bm: MetaBusiness) => {
    setSelectingBm(bm.id);
    try {
      const res = await authFetch('/api/agency-access-config/meta/select-bm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_business_id: bm.id, meta_business_name: bm.name }),
      });
      if (!res.ok) {
        setError('Failed to select Business Manager');
        return;
      }
      setConfig((prev) => ({
        ...prev,
        meta_business_id: bm.id,
        meta_business_name: bm.name,
      }));
      setBmPickerOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('meta_pick_bm');
      url.searchParams.delete('meta_businesses');
      window.history.replaceState({}, '', url.toString());
    } catch {
      setError('Failed to select Business Manager');
    } finally {
      setSelectingBm(null);
    }
  };

  const handleConnectMeta = async () => {
    setConnectingMeta(true);
    try {
      const res = await authFetch('/api/agency-access-config/meta', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to start Meta connection');
        return;
      }
      const { authorize_url } = await res.json();
      window.location.href = authorize_url;
    } catch {
      setError('Failed to connect Meta');
      setConnectingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    setSaving(true);
    try {
      await authFetch('/api/agency-access-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_business_id: null,
          meta_business_name: null,
        }),
      });
      setConfig((prev) => ({
        ...prev,
        meta_business_id: null,
        meta_business_name: null,
        meta_user_name: null,
      }));
    } catch {
      setError('Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await authFetch('/api/agency-access-config/google', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to start Google connection');
        return;
      }
      const { authorize_url } = await res.json();
      window.location.href = authorize_url;
    } catch {
      setError('Failed to connect Google');
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setSaving(true);
    try {
      await authFetch('/api/agency-access-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_mcc_id: null,
          google_mcc_name: null,
          google_analytics_email: null,
          google_gtm_email: null,
        }),
      });
      setConfig((prev) => ({
        ...prev,
        google_mcc_id: null,
        google_mcc_name: null,
        google_analytics_email: null,
        google_gtm_email: null,
        google_user_name: null,
      }));
    } catch {
      setError('Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWordpress = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await authFetch('/api/agency-access-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordpress_admin_email: config.wordpress_admin_email.trim() || null }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to save');
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-dim py-4">Loading configuration…</div>;
  }

  const metaConnected = !!config.meta_business_id;
  const googleConnected = !!config.google_analytics_email;

  return (
    <div className="space-y-6">
      {/* Meta */}
      <div className="border border-edge rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink">Meta Business Manager</h4>
              {metaConnected ? (
                <p className="text-xs text-muted mt-0.5">
                  Connected: <span className="text-ink font-medium">{config.meta_business_name || config.meta_business_id}</span>
                  {config.meta_user_name && <span className="text-dim"> · {config.meta_user_name}</span>}
                </p>
              ) : (
                <p className="text-xs text-muted mt-0.5">Connect your Meta Business Manager to receive client ad account access</p>
              )}
            </div>
          </div>
          {metaConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <Button variant="ghost" size="sm" leftIcon={Unlink} onClick={handleDisconnectMeta} loading={saving}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" leftIcon={Link2} onClick={handleConnectMeta} loading={connectingMeta}>
              Connect Meta
            </Button>
          )}
        </div>
      </div>

      {/* Google */}
      <div className="border border-edge rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink">Google</h4>
              {googleConnected ? (
                <div className="text-xs text-muted mt-0.5 space-y-0.5">
                  <p>
                    Connected: <span className="text-ink font-medium">{config.google_analytics_email}</span>
                    {config.google_user_name && <span className="text-dim"> · {config.google_user_name}</span>}
                  </p>
                  {config.google_mcc_id && (
                    <p>MCC: <span className="text-ink font-medium">{config.google_mcc_id}</span></p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted mt-0.5">Connect your Google account for GA4, GTM, and Ads access grants</p>
              )}
            </div>
          </div>
          {googleConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <Button variant="ghost" size="sm" leftIcon={Unlink} onClick={handleDisconnectGoogle} loading={saving}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" leftIcon={Link2} onClick={handleConnectGoogle} loading={connectingGoogle}>
              Connect Google
            </Button>
          )}
        </div>
      </div>

      {/* WordPress */}
      <div className="border border-edge rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#21759B]/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#21759B">
              <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.433 12c0-1.198.258-2.335.714-3.363L8.07 20.238A8.576 8.576 0 0 1 3.433 12zm8.567 8.567c-.874 0-1.716-.138-2.508-.391l2.662-7.737 2.727 7.473c.018.044.04.084.063.123a8.534 8.534 0 0 1-2.944.532zm1.201-12.594c.534-.028 1.015-.084 1.015-.084.478-.056.422-.757-.056-.729 0 0-1.435.113-2.361.113-.877 0-2.353-.113-2.353-.113-.478-.028-.534.701-.056.729 0 0 .452.056.93.084L11.47 11.5l-2.01 6.03-3.351-9.958c.534-.028 1.015-.084 1.015-.084.478-.056.422-.757-.056-.729 0 0-1.435.113-2.361.113-.166 0-.362-.004-.567-.011A8.552 8.552 0 0 1 12 3.433c2.143 0 4.097.788 5.595 2.088-.036-.002-.07-.008-.107-.008-1.237 0-2.115 1.079-2.115 2.241 0 .729.422 1.346.87 2.075.337.591.73 1.346.73 2.437 0 .757-.29 1.633-.673 2.858l-.882 2.943-3.19-9.494z"/>
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">WordPress</h4>
            <p className="text-xs text-muted mt-0.5">The email address clients should add as an admin on their WordPress site</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={config.wordpress_admin_email}
            onChange={(e) => setConfig((prev) => ({ ...prev, wordpress_admin_email: e.target.value }))}
            placeholder="admin@youragency.com"
            className="flex-1 px-3 py-2 rounded-xl bg-surface border border-edge text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
          />
          <Button variant="primary" size="sm" leftIcon={Save} onClick={handleSaveWordpress} loading={saving}>
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

      {bmPickerOpen && availableBusinesses.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface border border-edge rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                <Building2 size={18} className="text-[#1877F2]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Select Business Manager</h3>
                <p className="text-xs text-muted mt-0.5">Multiple Business Managers found. Choose the one to use for client access requests.</p>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableBusinesses.map((bm) => (
                <button
                  key={bm.id}
                  onClick={() => handleSelectBm(bm)}
                  disabled={selectingBm !== null}
                  className="w-full text-left px-4 py-3 rounded-xl border border-edge hover:border-teal/40 hover:bg-teal/5 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-ink">{bm.name}</p>
                  <p className="text-xs text-muted mt-0.5">ID: {bm.id}</p>
                  {selectingBm === bm.id && <p className="text-xs text-teal mt-1">Selecting…</p>}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setBmPickerOpen(false);
                const url = new URL(window.location.href);
                url.searchParams.delete('meta_pick_bm');
                url.searchParams.delete('meta_businesses');
                window.history.replaceState({}, '', url.toString());
              }}
              className="mt-4 w-full text-center text-xs text-muted hover:text-ink transition-colors py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
