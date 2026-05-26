// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Mail className="text-teal" size={24} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Check your email</h2>
          <p className="text-muted text-sm mb-6">
            If an account exists for <strong className="text-ink">{email}</strong>, we&apos;ve sent a link to reset your password.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-[#01434A] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </div>
        <LegalFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-ink">Reset your password</h1>
          <p className="text-sm text-faint mt-1">We&apos;ll email you a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button
            type="submit"
            fullWidth
            loading={loading}
            rightIcon={ArrowRight}
          >
            Send Reset Link
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-muted transition-colors"
          >
            <ArrowLeft size={12} />
            Back to sign in
          </Link>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}

function LegalFooter() {
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-xs text-white/60">
      <a href="/privacy-policy" className="hover:text-white/90 transition-colors">Privacy Policy</a>
      <span>&middot;</span>
      <a href="/terms-and-conditions" className="hover:text-white/90 transition-colors">Terms &amp; Conditions</a>
    </div>
  );
}
