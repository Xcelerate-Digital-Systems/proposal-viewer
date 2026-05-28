// app/login/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, User, ArrowRight, Building2, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

type Method = 'password' | 'magic';
type Mode = 'signin' | 'signup';

type InviteInfo = {
  email: string;
  role: string;
  company_name: string;
  expires_at: string;
};

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const nextUrl = searchParams.get('next');
  const postLoginTarget = nextUrl && nextUrl.startsWith('/') ? nextUrl : '/';
  const {
    signInWithPassword,
    signInWithMagicLink,
    signInWithOAuth,
    signUp,
    session,
    loading: authLoading,
  } = useAuth();

  const signupRequested = searchParams.get('signup') === '1';
  const initialMode: Mode = inviteToken
    ? 'signup'
    : signupRequested && PUBLIC_SIGNUP_ON
      ? 'signup'
      : 'signin';
  const [mode, setMode] = useState<Mode>(initialMode);

  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    const e = searchParams.get('error');
    if (e === 'signup_disabled') {
      setError('Public sign-up isn’t open yet. Ask your team owner for an invite.');
    } else if (e) {
      setError(e);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!inviteToken) return;
    const validateInvite = async () => {
      try {
        const res = await fetch(`/api/invites/validate?token=${inviteToken}`);
        const data = await res.json();
        if (!res.ok) { setInviteError(data.error || 'Invalid invite'); return; }
        setInviteInfo(data);
        setEmail(data.email);
      } catch {
        setInviteError('Failed to validate invite');
      } finally {
        setInviteLoading(false);
      }
    };
    validateInvite();
  }, [inviteToken]);

  if (session && !authLoading) {
    router.replace(postLoginTarget);
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (method === 'magic') {
      const { error } = await signInWithMagicLink(email);
      if (error) {
        if (/signups not allowed/i.test(error.message)) {
          setError("No account found for this email. Ask your team owner to send you an invite.");
        } else {
          setError(error.message);
        }
      } else {
        setMagicLinkSent(true);
      }
    } else {
      const { error } = await signInWithPassword(email, password);
      if (error) setError(error.message);
      else router.replace(postLoginTarget);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!inviteToken && !companyName.trim()) { setError('Agency name is required'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, name, {
      inviteToken: inviteToken || undefined,
      companyName: inviteToken ? undefined : companyName.trim(),
    });
    if (error) setError((error as { message?: string }).message || 'Signup failed');
    else router.replace(inviteToken ? postLoginTarget : '/onboarding');
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setOauthLoading(true);
    const { error } = await signInWithOAuth('google');
    if (error) { setError(error.message); setOauthLoading(false); }
  };

  // ── Special states ──────────────────────────────────────────────

  if (inviteLoading) {
    return (
      <Shell>
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-teal mx-auto mb-3" />
          <p className="text-sm text-faint">Validating invite...</p>
        </div>
      </Shell>
    );
  }

  if (inviteToken && inviteError) {
    return (
      <Shell>
        <div className="w-full max-w-sm mx-auto text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <UserPlus className="text-red-500" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Invalid Invite</h2>
          <p className="text-muted text-sm mb-6">{inviteError}</p>
          <Button variant="link" onClick={() => router.replace('/login')}>Go to sign in</Button>
        </div>
      </Shell>
    );
  }

  if (magicLinkSent) {
    return (
      <Shell>
        <div className="w-full max-w-sm mx-auto text-center">
          <div className="w-14 h-14 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Mail className="text-teal" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Check your email</h2>
          <p className="text-muted text-sm mb-6">
            We sent a sign-in link to <strong className="text-ink">{email}</strong>
          </p>
          <Button variant="link" onClick={() => { setMagicLinkSent(false); setEmail(''); }}>
            Use a different email
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Main form ───────────────────────────────────────────────────

  const showSignup = mode === 'signup';
  const canSelfServeSignup = PUBLIC_SIGNUP_ON && !inviteToken;
  const headerTitle = inviteInfo
    ? 'Join your team'
    : showSignup
      ? 'Create your agency'
      : 'Welcome back';
  const headerSubtitle = inviteInfo
    ? 'Complete your account setup'
    : showSignup
      ? 'Start your 7-day trial'
      : 'Sign in to your account';

  return (
    <Shell>
      <div className="w-full max-w-[400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink font-[family-name:var(--font-manrope)] tracking-tight">
            {headerTitle}
          </h1>
          <p className="text-sm text-faint mt-1.5">{headerSubtitle}</p>
        </div>

        {/* Invite Banner */}
        {inviteInfo && (
          <div className="bg-teal/5 border border-teal/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-teal mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-ink font-medium">
                  You&apos;ve been invited to join{' '}
                  <span className="text-teal">{inviteInfo.company_name}</span>
                </p>
                <p className="text-xs text-muted mt-1">
                  Role: <span className="capitalize text-ink">{inviteInfo.role}</span>
                  {' · '}Invited as <span className="text-ink">{inviteInfo.email}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Google OAuth */}
        {canSelfServeSignup && (
          <>
            <Button variant="secondary" fullWidth loading={oauthLoading} onClick={handleGoogle}>
              <GoogleGlyph />
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-edge" />
              <span className="text-xs text-faint">or</span>
              <div className="h-px flex-1 bg-edge" />
            </div>
          </>
        )}

        {!showSignup ? (
          <>
            {/* Method toggle */}
            <div className="flex gap-1 mb-5 bg-surface rounded-xl p-1">
              <button
                onClick={() => { setMethod('password'); setError(''); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  method === 'password'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-faint hover:text-muted'
                }`}
              >
                Password
              </button>
              <button
                onClick={() => { setMethod('magic'); setError(''); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  method === 'magic'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-faint hover:text-muted'
                }`}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={handleSignIn} className="space-y-3">
              <InputField
                type="email"
                icon={<Mail size={16} />}
                placeholder="you@company.com"
                value={email}
                onChange={setEmail}
                required
              />
              {method === 'password' && (
                <>
                  <InputField
                    type="password"
                    icon={<Lock size={16} />}
                    placeholder="Password"
                    value={password}
                    onChange={setPassword}
                    required
                  />
                  <div className="text-right">
                    <Link
                      href="/forgot-password"
                      className="text-xs text-faint hover:text-teal transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </>
              )}
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <Button type="submit" fullWidth loading={loading} rightIcon={ArrowRight}>
                {method === 'magic' ? 'Send Magic Link' : 'Sign In'}
              </Button>
            </form>

            {canSelfServeSignup && (
              <p className="text-xs text-faint text-center mt-6">
                New to AgencyViz?{' '}
                <Button variant="link" onClick={() => { setMode('signup'); setError(''); }}>
                  Create an account
                </Button>
              </p>
            )}
          </>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-3">
            <InputField
              type="text"
              icon={<User size={16} />}
              placeholder="Your name"
              value={name}
              onChange={setName}
              required
            />
            {!inviteToken && (
              <InputField
                type="text"
                icon={<Building2 size={16} />}
                placeholder="Agency name"
                value={companyName}
                onChange={setCompanyName}
                required
              />
            )}
            <InputField
              type="email"
              icon={<Mail size={16} />}
              placeholder="you@company.com"
              value={email}
              onChange={setEmail}
              required
              readOnly={!!inviteInfo}
              disabled={!!inviteInfo}
            />
            <InputField
              type="password"
              icon={<Lock size={16} />}
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={setPassword}
              required
              minLength={6}
            />
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <Button type="submit" fullWidth loading={loading} rightIcon={ArrowRight}>
              {inviteInfo ? `Join ${inviteInfo.company_name}` : 'Start 7-day free trial'}
            </Button>

            {!inviteToken && (
              <p className="text-xs text-faint text-center mt-6">
                Already have an account?{' '}
                <Button variant="link" onClick={() => { setMode('signin'); setError(''); }}>
                  Sign in instead
                </Button>
              </p>
            )}
          </form>
        )}

        {inviteInfo && (
          <p className="text-xs text-faint text-center mt-6">
            Already have an account?{' '}
            <Button variant="link" onClick={() => router.replace('/login')}>
              Sign in instead
            </Button>
          </p>
        )}
      </div>
    </Shell>
  );
}

// ── Layout shell: split-screen with branded left panel ─────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] bg-surface-dark flex-col justify-between p-10 relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at 30% 80%, rgba(138,217,209,0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(1,124,135,0.15) 0%, transparent 50%)',
          }}
        />

        <div className="relative z-10">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-semibold text-white font-[family-name:var(--font-manrope)] tracking-tight leading-snug">
            Win more clients<br />with stunning pitches
          </h2>
          <p className="text-surface-dark-accent/70 text-sm leading-relaxed max-w-[340px]">
            Create proposals, quotes, and review boards that wow your clients.
            All the tools your agency needs in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Proposals', 'Quotes', 'Creative Review', 'Templates'].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-surface-dark-border text-surface-dark-accent/80"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-surface-dark-accent/50">
          <a href="/privacy-policy" className="hover:text-surface-dark-accent/80 transition-colors">
            Privacy Policy
          </a>
          <span>&middot;</span>
          <a href="/terms-and-conditions" className="hover:text-surface-dark-accent/80 transition-colors">
            Terms &amp; Conditions
          </a>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile logo */}
        <div className="lg:hidden px-6 pt-6">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          {children}
        </div>

        {/* Mobile legal footer */}
        <div className="lg:hidden pb-6 flex items-center justify-center gap-3 text-xs text-faint">
          <a href="/privacy-policy" className="hover:text-muted transition-colors">Privacy Policy</a>
          <span>&middot;</span>
          <a href="/terms-and-conditions" className="hover:text-muted transition-colors">Terms &amp; Conditions</a>
        </div>
      </div>
    </div>
  );
}

// ── Shared input field ─────────────────────────────────────────────

function InputField({
  type, icon, placeholder, value, onChange, required, readOnly, disabled, minLength,
}: {
  type: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  minLength?: number;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        minLength={minLength}
        className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{children}</p>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Loader2 size={24} className="animate-spin text-teal" />
        </Shell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
