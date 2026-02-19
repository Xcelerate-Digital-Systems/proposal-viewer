// app/login/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, Lock, User, ArrowRight, Building2, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'signin' | 'signup';
type Method = 'password' | 'magic';

type InviteInfo = {
  email: string;
  role: string;
  company_name: string;
  expires_at: string;
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const { signInWithPassword, signInWithMagicLink, signUp, session, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>(inviteToken ? 'signup' : 'signin');
  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Invite state
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState('');

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;

    const validateInvite = async () => {
      try {
        const res = await fetch(`/api/invites/validate?token=${inviteToken}`);
        const data = await res.json();

        if (!res.ok) {
          setInviteError(data.error || 'Invalid invite');
          return;
        }

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

  // If already logged in, redirect to dashboard
  if (session && !authLoading) {
    router.replace('/');
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (method === 'magic') {
      const { error } = await signInWithMagicLink(email);
      if (error) setError(error.message);
      else setMagicLinkSent(true);
    } else {
      const { error } = await signInWithPassword(email, password);
      if (error) setError(error.message);
      else router.replace('/');
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    const { error } = await signUp(email, password, name, inviteToken || undefined);
    if (error) setError((error as any).message || 'Signup failed');
    else router.replace('/');
    setLoading(false);
  };

  // Loading state for invite validation
  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-[#ff6700] mx-auto mb-3" />
          <p className="text-sm text-[#999]">Validating invite...</p>
        </div>
      </div>
    );
  }

  // Invalid invite
  if (inviteToken && inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <UserPlus className="text-red-400" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Invalid Invite</h2>
          <p className="text-[#999] text-sm mb-6">{inviteError}</p>
          <button
            onClick={() => router.replace('/login')}
            className="text-sm text-[#ff6700] hover:text-[#ff8533] transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-[#ff6700]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Mail className="text-[#ff6700]" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
          <p className="text-[#999] text-sm mb-6">
            We sent a sign-in link to <strong className="text-white">{email}</strong>
          </p>
          <button
            onClick={() => { setMagicLinkSent(false); setEmail(''); }}
            className="text-sm text-[#ff6700] hover:text-[#ff8533] transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-white">
            {inviteInfo
              ? 'Join your team'
              : tab === 'signin'
                ? 'Sign in to your account'
                : 'Create your account'}
          </h1>
          <p className="text-sm text-[#666] mt-1">
            {inviteInfo ? 'Complete your account setup' : 'Team members only'}
          </p>
        </div>

        {/* Invite Banner */}
        {inviteInfo && (
          <div className="bg-[#ff6700]/5 border border-[#ff6700]/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-[#ff6700] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">
                  You&apos;ve been invited to join{' '}
                  <span className="text-[#ff6700]">{inviteInfo.company_name}</span>
                </p>
                <p className="text-xs text-[#999] mt-1">
                  Role: <span className="capitalize text-[#ccc]">{inviteInfo.role}</span>
                  {' · '}Invited as{' '}
                  <span className="text-[#ccc]">{inviteInfo.email}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - hide if invite (force signup) */}
        {!inviteInfo && (
          <div className="flex bg-[#1a1a1a] rounded-lg p-1 mb-6">
            <button
              onClick={() => { setTab('signin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'signin' ? 'bg-[#2a2a2a] text-white' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'signup' ? 'bg-[#2a2a2a] text-white' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {(tab === 'signin' && !inviteInfo) ? (
          <>
            {/* Sign-in method toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setMethod('password'); setError(''); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  method === 'password'
                    ? 'border-[#ff6700] text-[#ff6700] bg-[#ff6700]/5'
                    : 'border-[#2a2a2a] text-[#666] hover:border-[#444]'
                }`}
              >
                Password
              </button>
              <button
                onClick={() => { setMethod('magic'); setError(''); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  method === 'magic'
                    ? 'border-[#ff6700] text-[#ff6700] bg-[#ff6700]/5'
                    : 'border-[#2a2a2a] text-[#666] hover:border-[#444]'
                }`}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
                />
              </div>

              {method === 'password' && (
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#ff6700] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {method === 'magic' ? 'Send Magic Link' : 'Sign In'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
              />
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={!!inviteInfo}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50 ${
                  inviteInfo ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#ff6700] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {inviteInfo ? `Join ${inviteInfo.company_name}` : 'Create Account'}
            </button>

            {!inviteInfo && (
              <p className="text-xs text-[#555] text-center mt-3">
                A new workspace will be created for you
              </p>
            )}
          </form>
        )}

        {/* Link between sign in and invited signup */}
        {inviteInfo && (
          <p className="text-xs text-[#555] text-center mt-4">
            Already have an account?{' '}
            <button
              onClick={() => router.replace('/login')}
              className="text-[#ff6700] hover:text-[#ff8533]"
            >
              Sign in instead
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
          <Loader2 size={24} className="animate-spin text-[#ff6700]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}