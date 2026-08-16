'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AccessPageShell from '@/components/client-access/AccessPageShell';
import PlatformCard from '@/components/client-access/PlatformCard';
import WordPressInstructions from '@/components/client-access/WordPressInstructions';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import type { AccessPlatform, AccessGrantStatus } from '@/lib/client-access/types';
import { PLATFORM_LABELS, VALID_PLATFORMS } from '@/lib/client-access/types';

interface Grant {
  id: string;
  platform: AccessPlatform;
  status: AccessGrantStatus;
  platform_account_name: string | null;
  error_message: string | null;
}

interface AgencyInfo {
  name: string;
  slug: string | null;
  logo_url: string | null;
  accent_color: string;
  bg_primary: string;
  bg_secondary: string;
  font_heading: string | null;
  font_body: string | null;
  wordpress_email: string | null;
}

interface RequestData {
  type: 'request';
  request: {
    id: string;
    platforms: AccessPlatform[];
    status: string;
    client_name: string | null;
    notes: string | null;
    expires_at: string | null;
  };
  grants: Grant[];
  agency: AgencyInfo;
}

interface UniversalData {
  type: 'universal';
  company_id: string;
  default_platforms: AccessPlatform[];
  agency: AgencyInfo;
}

type AccessData = RequestData | UniversalData;

export default function AccessTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/access/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'This access link is no longer available.');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError('Unable to load this page. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConnect = useCallback((platform: AccessPlatform) => {
    if (platform === 'wordpress') return;
    const platformRoute = platform === 'meta' ? 'meta' : 'google';
    window.location.href = `/api/access/${token}/${platformRoute}/start?platform=${platform}`;
  }, [token]);

  if (loading) {
    const fallbackBranding = {
      accent_color: '#017C87',
      bg_primary: '#01434A',
      bg_secondary: '#141414',
      sidebar_text_color: '#ffffff',
    };
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#141414' }}>
        <ViewerLoader branding={fallbackBranding as never} loading={true} label="Loading…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#141414' }}>
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Link Unavailable</h1>
          <p className="text-sm text-gray-400">{error || 'This access link is no longer available.'}</p>
        </div>
      </div>
    );
  }

  // Universal link — show client registration form
  if (data.type === 'universal') {
    return (
      <AccessPageShell
        agencyName={data.agency.name}
        logoUrl={data.agency.logo_url}
        accentColor={data.agency.accent_color}
        bgPrimary={data.agency.bg_primary}
        bgSecondary={data.agency.bg_secondary}
        fontHeading={data.agency.font_heading}
        fontBody={data.agency.font_body}
        clientName={null}
        notes={null}
      >
        <UniversalRegistrationForm
          token={token}
          defaultPlatforms={data.default_platforms}
          accentColor={data.agency.accent_color}
          onRegistered={(newToken) => {
            router.replace(`/access/${newToken}`);
          }}
        />
      </AccessPageShell>
    );
  }

  // Per-client request — show platform cards
  const { request, grants, agency } = data;
  const grantByPlatform = new Map<AccessPlatform, Grant>();
  for (const g of grants) {
    grantByPlatform.set(g.platform, g);
  }

  return (
    <AccessPageShell
      agencyName={agency.name}
      logoUrl={agency.logo_url}
      accentColor={agency.accent_color}
      bgPrimary={agency.bg_primary}
      bgSecondary={agency.bg_secondary}
      fontHeading={agency.font_heading}
      fontBody={agency.font_body}
      clientName={request.client_name}
      notes={request.notes}
    >
      {request.platforms.map((platform) => {
        const grant = grantByPlatform.get(platform);

        if (platform === 'wordpress') {
          return (
            <WordPressInstructions
              key={platform}
              token={token}
              agencyEmail={agency.wordpress_email}
              status={grant?.status ?? 'pending'}
              accentColor={agency.accent_color}
              onConfirmed={fetchData}
            />
          );
        }

        return (
          <PlatformCard
            key={platform}
            platform={platform}
            status={grant?.status ?? 'pending'}
            accountName={grant?.platform_account_name}
            errorMessage={grant?.error_message}
            accentColor={agency.accent_color}
            onConnect={handleConnect}
          />
        );
      })}
    </AccessPageShell>
  );
}

function UniversalRegistrationForm({
  token,
  defaultPlatforms,
  accentColor,
  onRegistered,
}: {
  token: string;
  defaultPlatforms: AccessPlatform[];
  accentColor: string;
  onRegistered: (newToken: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<AccessPlatform[]>(defaultPlatforms);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const togglePlatform = (p: AccessPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !email.trim()) {
      setFormError('Please enter your name or email.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setFormError('Please select at least one platform.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/access/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: name.trim() || null,
          client_email: email.trim() || null,
          platforms: selectedPlatforms,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFormError(body.error || 'Something went wrong.');
        return;
      }

      const { share_token } = await res.json();
      onRegistered(share_token);
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold text-white">Get Started</h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter your details and select which accounts to connect.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Your Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Your Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-2">Accounts to connect</label>
        <div className="space-y-2">
          {VALID_PLATFORMS.map((p) => (
            <label
              key={p}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
              style={{
                backgroundColor: selectedPlatforms.includes(p) ? `${accentColor}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedPlatforms.includes(p) ? `${accentColor}40` : 'transparent'}`,
              }}
            >
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(p)}
                onChange={() => togglePlatform(p)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-white">{PLATFORM_LABELS[p]}</span>
            </label>
          ))}
        </div>
      </div>

      {formError && <p className="text-xs text-red-400">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: accentColor }}
      >
        {submitting ? 'Setting up…' : 'Continue'}
      </button>
    </form>
  );
}
