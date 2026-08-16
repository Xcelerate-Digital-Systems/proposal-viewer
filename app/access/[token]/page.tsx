'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, Check, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import PlatformStatusBadge from '@/components/client-access/PlatformStatusBadge';
import WordPressInstructions from '@/components/client-access/WordPressInstructions';
import type { AccessPlatform, AccessGrantStatus } from '@/lib/client-access/types';
import { PLATFORM_LABELS, VALID_PLATFORMS } from '@/lib/client-access/types';
import type { PlatformConfig } from '@/lib/client-access/platform-config';
import { META_ASSETS, GOOGLE_ASSETS } from '@/lib/client-access/platform-config';

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
  platform_config: PlatformConfig | null;
}

interface RequestData {
  type: 'request';
  request: {
    id: string;
    platforms: AccessPlatform[];
    platform_config: PlatformConfig | null;
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
type WizardStep = 'landing' | 'register' | 'connect' | 'status';

export default function AccessTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>('landing');

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
      if (json.type === 'request') {
        const hasAnyGrant = json.grants?.some((g: Grant) => g.status !== 'pending');
        setStep(hasAnyGrant ? 'status' : 'landing');
      } else {
        setStep('landing');
      }
    } catch {
      setError('Unable to load this page. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-sm text-gray-500">{error || 'This access link is no longer available.'}</p>
        </div>
      </div>
    );
  }

  const agency = data.agency;
  const accentColor = agency.accent_color || '#017C87';
  const fonts = [agency.font_heading, agency.font_body].filter(Boolean) as string[];

  if (step === 'landing') {
    const clientName = data.type === 'request' ? data.request.client_name : null;
    const nextStep = data.type === 'universal' ? 'register' : 'connect';
    return (
      <WizardShell agency={agency} fonts={fonts}>
        <LandingStep
          agencyName={agency.name}
          agencyLogoUrl={agency.logo_url}
          accentColor={accentColor}
          bgPrimary={agency.bg_primary || '#01434A'}
          clientName={clientName}
          onStart={() => setStep(nextStep)}
        />
      </WizardShell>
    );
  }

  if (data.type === 'universal' && step === 'register') {
    return (
      <WizardShell agency={agency} fonts={fonts}>
        <RegisterStep
          token={token}
          defaultPlatforms={data.default_platforms}
          accentColor={accentColor}
          onRegistered={(newToken) => router.replace(`/access/${newToken}`)}
          onBack={() => setStep('landing')}
        />
      </WizardShell>
    );
  }

  if (data.type !== 'request') return null;

  const { request, grants } = data;
  const grantByPlatform = new Map<AccessPlatform, Grant>();
  for (const g of grants) grantByPlatform.set(g.platform, g);

  const allDone = request.platforms.every((p) => {
    const g = grantByPlatform.get(p);
    return g && (g.status === 'granted' || g.status === 'self_reported' || g.status === 'request_sent');
  });

  return (
    <WizardShell agency={agency} fonts={fonts}>
      {/* Step indicator */}
      <StepIndicator
        currentStep={step === 'connect' ? 1 : 2}
        steps={['Connect Accounts', 'Review Status']}
        accentColor={accentColor}
      />

      {step === 'connect' && (
        <ConnectStep
          token={token}
          request={request}
          grants={grants}
          agency={agency}
          accentColor={accentColor}
          onRefresh={fetchData}
          onNext={() => setStep('status')}
        />
      )}

      {step === 'status' && (
        <StatusStep
          request={request}
          grants={grants}
          agency={agency}
          accentColor={accentColor}
          allDone={allDone}
          onBack={() => setStep('connect')}
        />
      )}
    </WizardShell>
  );
}

/* ========== Shell ========== */

function WizardShell({ agency, fonts, children }: {
  agency: AgencyInfo;
  fonts: string[];
  children: React.ReactNode;
}) {
  const accentColor = agency.accent_color || '#017C87';
  const bgPrimary = agency.bg_primary || '#01434A';

  return (
    <div className="min-h-screen bg-[#f0f2f5]" style={{ fontFamily: agency.font_body ? `"${agency.font_body}", sans-serif` : 'system-ui, sans-serif' }}>
      {fonts.length > 0 && <GoogleFontLoader fonts={fonts} />}

      {/* Branded header bar */}
      <div className="w-full py-3 px-4 text-center text-white text-sm" style={{ backgroundColor: bgPrimary }}>
        <div className="flex items-center justify-center gap-2">
          {agency.logo_url ? (
            <img src={agency.logo_url} alt={agency.name} className="h-6 object-contain" />
          ) : (
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: accentColor }}>
              {agency.name.charAt(0)}
            </div>
          )}
          <span>
            <strong>{agency.name}</strong> is requesting partner access to your marketing assets.
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {children}
      </div>

      <div className="pb-6 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-2">
          <Shield size={12} />
          <span>Secure connection — your credentials are never shared</span>
        </div>
        <span className="text-[10px] text-gray-400">Powered by AgencyViz</span>
      </div>
    </div>
  );
}

/* ========== Step Indicator ========== */

function StepIndicator({ currentStep, steps, accentColor }: {
  currentStep: number;
  steps: string[];
  accentColor: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px" style={{ backgroundColor: isDone || isActive ? accentColor : '#d1d5db' }} />}
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: isDone || isActive ? accentColor : '#e5e7eb',
                  color: isDone || isActive ? '#fff' : '#6b7280',
                }}
              >
                {isDone ? <Check size={14} /> : stepNum}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ========== Landing Step ========== */

function LandingStep({ agencyName, agencyLogoUrl, accentColor, bgPrimary, clientName, onStart }: {
  agencyName: string;
  agencyLogoUrl: string | null;
  accentColor: string;
  bgPrimary: string;
  clientName: string | null;
  onStart: () => void;
}) {
  return (
    <div className="text-center">
      {/* Agency branding hero */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ backgroundColor: bgPrimary }}>
        <div className="px-6 py-10 sm:py-14">
          {agencyLogoUrl ? (
            <img src={agencyLogoUrl} alt={agencyName} className="h-12 sm:h-14 object-contain mx-auto mb-5" />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-5"
              style={{ backgroundColor: accentColor }}
            >
              {agencyName.charAt(0)}
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {clientName ? `Hi ${clientName}!` : 'Welcome!'}
          </h1>
          <p className="text-sm text-white/70 max-w-md mx-auto">
            <strong className="text-white">{agencyName}</strong> is requesting partner access to your marketing accounts. Follow the steps below to get started.
          </p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-5">3 Simple Steps</h2>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          { num: 1, title: 'Connect Your Accounts', desc: 'Sign in with your Google or Meta account to get started.' },
          { num: 2, title: 'Grant Access', desc: `Approve the specific permissions ${agencyName} needs to manage your accounts.` },
          { num: 3, title: 'Review Status', desc: 'Confirm everything is connected and you\'re all set.' },
        ].map((item) => (
          <div key={item.num} className="bg-white border border-gray-200 rounded-xl p-5 text-left">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
              style={{ backgroundColor: accentColor }}
            >
              {item.num}
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="px-8 py-3 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: accentColor }}
      >
        Get started
      </button>

      <p className="text-xs text-gray-400 mt-4 uppercase tracking-wider">It takes 2 minutes on average</p>
    </div>
  );
}

/* ========== Register Step (Universal links) ========== */

function RegisterStep({ token, defaultPlatforms, accentColor, onRegistered, onBack }: {
  token: string;
  defaultPlatforms: AccessPlatform[];
  accentColor: string;
  onRegistered: (newToken: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<AccessPlatform[]>(defaultPlatforms);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const togglePlatform = (p: AccessPlatform) => {
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !email.trim()) { setFormError('Please enter your name or email.'); return; }
    if (selectedPlatforms.length === 0) { setFormError('Please select at least one platform.'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/access/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: name.trim() || null, client_email: email.trim() || null, platforms: selectedPlatforms }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFormError(body.error || 'Something went wrong.');
        return;
      }
      const { share_token } = await res.json();
      onRegistered(share_token);
    } catch { setFormError('Something went wrong.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Enter Your Details</h2>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Your Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Your Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-2">Accounts to connect</label>
          <div className="space-y-2">
            {VALID_PLATFORMS.map((p) => (
              <label key={p} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${selectedPlatforms.includes(p) ? 'border-gray-300 bg-gray-50' : 'border-transparent bg-gray-50/50'}`}>
                <input type="checkbox" checked={selectedPlatforms.includes(p)} onChange={() => togglePlatform(p)} className="rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-900">{PLATFORM_LABELS[p]}</span>
              </label>
            ))}
          </div>
        </div>

        {formError && <p className="text-xs text-red-500">{formError}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onBack} className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
            <ArrowLeft size={14} /> Back
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: accentColor }}>
            {submitting ? 'Setting up…' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========== Connect Step ========== */

function ConnectStep({ token, request, grants, agency, accentColor, onRefresh, onNext }: {
  token: string;
  request: RequestData['request'];
  grants: Grant[];
  agency: AgencyInfo;
  accentColor: string;
  onRefresh: () => void;
  onNext: () => void;
}) {
  const grantByPlatform = new Map<AccessPlatform, Grant>();
  for (const g of grants) grantByPlatform.set(g.platform, g);

  const handleConnect = (platform: AccessPlatform) => {
    if (platform === 'wordpress') return;
    const platformRoute = platform === 'meta' ? 'meta' : 'google';
    window.location.href = `/api/access/${token}/${platformRoute}/start?platform=${platform}`;
  };

  const platformConfig = request.platform_config;
  const metaAssets = platformConfig?.meta;
  const googleAssets = platformConfig?.google;

  const hasMetaPlatform = request.platforms.includes('meta');
  const hasGooglePlatforms = request.platforms.some((p) => p.startsWith('google_'));
  const hasWordpress = request.platforms.includes('wordpress');

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Connect Your Accounts</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Sign in to grant <strong>{agency.name}</strong> access to your accounts.
      </p>

      <div className="space-y-4">
        {/* Google Card */}
        {hasGooglePlatforms && (
          <PlatformConnectCard
            icon={<GoogleCardIcon />}
            title="Google Assets"
            subtitle="Requested assets and permissions"
            accentColor={accentColor}
          >
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-4 text-sm">
              {request.platforms.filter((p) => p.startsWith('google_')).map((p) => {
                const grant = grantByPlatform.get(p);
                const googleKey = p as keyof NonNullable<typeof googleAssets>;
                const assetDef = GOOGLE_ASSETS.find((a) => a.key === googleKey);
                const roleName = googleAssets?.[googleKey]?.role;
                const roleLabel = assetDef?.roles.find((r) => r.value === roleName)?.label || roleName || '';
                return (
                  <div key={p} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-gray-700">{PLATFORM_LABELS[p]}</span>
                    <div className="flex items-center gap-2">
                      {roleLabel && <span className="text-gray-500 text-xs">{roleLabel}</span>}
                      {grant && grant.status !== 'pending' && <PlatformStatusBadge status={grant.status} />}
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const googleGrants = request.platforms.filter((p) => p.startsWith('google_')).map((p) => grantByPlatform.get(p));
              const allConnected = googleGrants.every((g) => g && g.status !== 'pending' && g.status !== 'failed');
              if (allConnected) {
                return (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium py-2">
                    <Check size={16} /> Connected
                  </div>
                );
              }
              return (
                <button
                  onClick={() => handleConnect(request.platforms.find((p) => p.startsWith('google_'))!)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign in with Google
                </button>
              );
            })()}
          </PlatformConnectCard>
        )}

        {/* Meta Card */}
        {hasMetaPlatform && (
          <PlatformConnectCard
            icon={<MetaCardIcon />}
            title="Meta Assets"
            subtitle="Requested assets and permissions"
            accentColor={accentColor}
          >
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-4 text-sm">
              {META_ASSETS.filter((a) => metaAssets?.[a.key as keyof NonNullable<typeof metaAssets>]?.enabled).map((asset) => {
                const assetKey = asset.key as keyof NonNullable<typeof metaAssets>;
                const roleName = metaAssets?.[assetKey]?.role;
                const roleLabel = asset.roles.find((r) => r.value === roleName)?.label || roleName || '';
                return (
                  <div key={asset.key} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-gray-700">{asset.label}</span>
                    {roleLabel && <span className="text-gray-500 text-xs">{roleLabel}</span>}
                  </div>
                );
              })}
            </div>
            {(() => {
              const metaGrant = grantByPlatform.get('meta');
              if (metaGrant && metaGrant.status !== 'pending' && metaGrant.status !== 'failed') {
                return (
                  <div className="flex items-center gap-2 text-sm font-medium py-2">
                    <PlatformStatusBadge status={metaGrant.status} />
                    {metaGrant.status === 'request_sent' && (
                      <span className="text-xs text-yellow-600">Check Meta Business Suite to approve</span>
                    )}
                  </div>
                );
              }
              return (
                <button
                  onClick={() => handleConnect('meta')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1877F2] rounded-lg text-sm font-medium text-white hover:bg-[#166FE5] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Sign in with Meta
                </button>
              );
            })()}
          </PlatformConnectCard>
        )}

        {/* WordPress Card */}
        {hasWordpress && (
          <PlatformConnectCard
            icon={<WordPressCardIcon />}
            title="WordPress Access"
            subtitle="Manual setup required"
            accentColor={accentColor}
          >
            <WordPressInstructions
              token={token}
              agencyEmail={agency.wordpress_email}
              status={grantByPlatform.get('wordpress')?.status ?? 'pending'}
              accentColor={accentColor}
              onConfirmed={onRefresh}
            />
          </PlatformConnectCard>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ========== Status Step ========== */

function StatusStep({ request, grants, agency, accentColor, allDone, onBack }: {
  request: RequestData['request'];
  grants: Grant[];
  agency: AgencyInfo;
  accentColor: string;
  allDone: boolean;
  onBack: () => void;
}) {
  const grantByPlatform = new Map<AccessPlatform, Grant>();
  for (const g of grants) grantByPlatform.set(g.platform, g);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Access Status</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Review the access status for each platform.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {request.platforms.map((platform) => {
            const grant = grantByPlatform.get(platform);
            const status = grant?.status ?? 'pending';
            return (
              <div key={platform} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <PlatformMiniIcon platform={platform} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{PLATFORM_LABELS[platform]}</p>
                    {grant?.platform_account_name && (
                      <p className="text-xs text-gray-500">{grant.platform_account_name}</p>
                    )}
                  </div>
                </div>
                <PlatformStatusBadge status={status} />
              </div>
            );
          })}
        </div>
      </div>

      {allDone && (
        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
            <Check size={16} />
            All done!
          </div>
          <p className="text-xs text-emerald-600">
            {agency.name} now has the access they need. You can close this page.
          </p>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    </div>
  );
}

/* ========== Shared Components ========== */

function PlatformConnectCard({ icon, title, subtitle, accentColor, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PlatformMiniIcon({ platform }: { platform: AccessPlatform }) {
  if (platform === 'meta') return <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></div>;
  if (platform === 'wordpress') return <div className="w-8 h-8 rounded-lg bg-[#21759B]/10 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="#21759B"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2z"/></svg></div>;
  return <div className="w-8 h-8 rounded-lg bg-[#4285F4]/10 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/></svg></div>;
}

function GoogleCardIcon() {
  return (
    <div className="w-9 h-9 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    </div>
  );
}

function MetaCardIcon() {
  return (
    <div className="w-9 h-9 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" fill="#0866FF"/>
      </svg>
    </div>
  );
}

function WordPressCardIcon() {
  return (
    <div className="w-9 h-9 rounded-lg bg-[#21759B]/10 flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#21759B">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.433 12c0-1.198.258-2.335.714-3.363L8.07 20.238A8.576 8.576 0 0 1 3.433 12zm8.567 8.567c-.874 0-1.716-.138-2.508-.391l2.662-7.737 2.727 7.473c.018.044.04.084.063.123a8.534 8.534 0 0 1-2.944.532z"/>
      </svg>
    </div>
  );
}
