'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';

interface ShareLinkPasswordGateProps {
  token: string;
  /** Accent color for the primary button. */
  accentColor?: string;
  /** Optional brand logo. */
  logoUrl?: string | null;
  /** Optional company name. */
  companyName?: string | null;
  /** Optional heading font. */
  fontHeading?: string | null;
  /** Called after successful password verification. */
  onVerified: () => void;
}

/**
 * Password gate shown when a share link requires a password.
 * Styled consistently with GuestOnboardingModal.
 */
export default function ShareLinkPasswordGate({
  token,
  accentColor = '#017C87',
  logoUrl,
  companyName,
  fontHeading,
  onVerified,
}: ShareLinkPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/review/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password.trim() }),
      });

      if (res.ok) {
        onVerified();
        return;
      }

      if (res.status === 410) {
        setError('This review link has expired.');
        return;
      }

      if (res.status === 429) {
        setError('Too many attempts. Please try again later.');
        return;
      }

      setError('Incorrect password. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const initial = (companyName?.trim()?.[0] ?? 'R').toUpperCase();
  const headingFont = fontHeading ? fontFamily(fontHeading) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-gradient-to-br from-slate-50 to-slate-100">
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.2)] overflow-hidden animate-[cardIn_220ms_cubic-bezier(0.22,0.61,0.36,1)]"
      >
        {/* Brand ribbon */}
        <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

        <div className="px-7 pt-7 pb-6">
          {/* Logo / initial */}
          <div className="flex items-center gap-3 mb-5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName ?? 'Brand logo'}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-base font-semibold shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                {initial}
              </div>
            )}
            {companyName && !logoUrl && (
              <span
                className="text-sm font-semibold text-ink truncate"
                style={{ fontFamily: headingFont }}
              >
                {companyName}
              </span>
            )}
          </div>

          {/* Lock icon + heading */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Lock size={16} className="text-slate-500" />
            </div>
            <h2
              className="text-[22px] leading-tight font-semibold text-ink"
              style={{ fontFamily: headingFont }}
            >
              Password required
            </h2>
          </div>
          <p className="text-caption text-dim leading-relaxed mt-2">
            This review link is password protected. Enter the password to continue.
          </p>

          {/* Password input */}
          <div className="mt-5">
            <div className="relative">
              <input
                ref={inputRef}
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder=" "
                className={`peer w-full px-3.5 pt-5 pb-2 rounded-2xl bg-surface border text-sm text-ink outline-none transition-all focus:bg-white focus:border-edge-hover focus:ring-2 ${
                  error ? 'border-red-300 focus:border-red-300' : 'border-edge-strong'
                }`}
                style={{ ['--tw-ring-color' as string]: error ? '#fecaca' : `${accentColor}25` }}
              />
              <label
                className="absolute left-3.5 top-1.5 text-2xs uppercase tracking-wide font-medium text-faint transition-all pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-faint peer-focus:top-1.5 peer-focus:text-2xs peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-dim"
              >
                Password
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-red-600">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!password.trim() || submitting}
            className="group mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? 'Verifying...' : 'Continue'}
            {!submitting && (
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0"
              />
            )}
          </button>

          {/* Footer */}
          <p className="mt-4 text-detail text-center text-faint">
            {companyName ? `A review from ${companyName}` : 'Protected review link'}
          </p>
        </div>
      </form>
    </div>
  );
}
