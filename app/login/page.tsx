'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'signin' | 'signup';
type Method = 'password' | 'magic';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithPassword, signInWithMagicLink, signUp, session, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('signin');
  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
    const { error } = await signUp(email, password, name);
    if (error) setError(error.message);
    else router.replace('/');
    setLoading(false);
  };

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
        <div className="text-center mb-8">
          <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-white">
            {tab === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p className="text-sm text-[#666] mt-1">Team members only</p>
        </div>

        {/* Tabs */}
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

        {tab === 'signin' ? (
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
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
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
              Create Account
            </button>
          </form>
        )}
      </div>
    </div>
  );
}