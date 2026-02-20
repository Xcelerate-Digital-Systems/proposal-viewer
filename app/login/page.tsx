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
      <div className="min-h-screen flex items-center justify-center bg-[#017C87] px-4">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-white/70 mx-auto mb-3" />
          <p className="text-sm text-white/70">Validating invite...</p>
        </div>
      </div>
    );
  }

  // Invalid invite
  if (inviteToken && inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#017C87] px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <UserPlus className="text-red-500" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite</h2>
          <p className="text-gray-500 text-sm mb-6">{inviteError}</p>
          <button
            onClick={() => router.replace('/login')}
            className="text-sm text-[#017C87] hover:text-[#01434A] transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#017C87] px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-[#017C87]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Mail className="text-[#017C87]" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm mb-6">
            We sent a sign-in link to <strong className="text-gray-900">{email}</strong>
          </p>
          <button
            onClick={() => { setMagicLinkSent(false); setEmail(''); }}
            className="text-sm text-[#017C87] hover:text-[#01434A] transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#017C87] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-gray-900">
            {inviteInfo
              ? 'Join your team'
              : tab === 'signin'
                ? 'Sign in to your account'
                : 'Create your account'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {inviteInfo ? 'Complete your account setup' : 'Team members only'}
          </p>
        </div>

        {/* Invite Banner */}
        {inviteInfo && (
          <div className="bg-[#017C87]/5 border border-[#017C87]/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-[#017C87] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-900 font-medium">
                  You&apos;ve been invited to join{' '}
                  <span className="text-[#017C87]">{inviteInfo.company_name}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Role: <span className="capitalize text-gray-700">{inviteInfo.role}</span>
                  {' · '}Invited as{' '}
                  <span className="text-gray-700">{inviteInfo.email}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - hide if invite (force signup) */}
        {!inviteInfo && (
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setTab('signin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
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
                    ? 'border-[#017C87] text-[#017C87] bg-[#017C87]/5'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                Password
              </button>
              <button
                onClick={() => { setMethod('magic'); setError(''); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  method === 'magic'
                    ? 'border-[#017C87] text-[#017C87] bg-[#017C87]/5'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
                />
              </div>

              {method === 'password' && (
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#017C87] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {method === 'magic' ? 'Send Magic Link' : 'Sign In'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
              />
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={!!inviteInfo}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 ${
                  inviteInfo ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#017C87] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {inviteInfo ? `Join ${inviteInfo.company_name}` : 'Create Account'}
            </button>

            {!inviteInfo && (
              <p className="text-xs text-gray-400 text-center mt-3">
                A new workspace will be created for you
              </p>
            )}
          </form>
        )}

        {/* Link between sign in and invited signup */}
        {inviteInfo && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Already have an account?{' '}
            <button
              onClick={() => router.replace('/login')}
              className="text-[#017C87] hover:text-[#01434A]"
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
        <div className="min-h-screen flex items-center justify-center bg-[#017C87]">
          <Loader2 size={24} className="animate-spin text-white/70" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}