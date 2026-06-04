'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';

interface GuestOnboardingModalProps {
  open: boolean;
  /** Called with a trimmed name (required) and optional email. */
  onSubmit: (name: string, email: string) => void;
  /** Accent color for the primary button (defaults to teal). */
  accentColor?: string;
  /** Optional brand logo — shown at the top of the card. */
  logoUrl?: string | null;
  /** Optional company name — used for the logo fallback and footer line. */
  companyName?: string | null;
  /** Optional project title — shown in the heading for context. */
  projectTitle?: string | null;
  /** Optional heading font family name. */
  fontHeading?: string | null;
}

/**
 * First-visit identity prompt for public review viewers. Matches the widget's
 * onboarding flow so a visitor only enters their name once per device.
 *
 * Surfaces company branding (logo + name + project title) so the reviewer has
 * a clear sense of who's asking and what they're about to review.
 */
export default function GuestOnboardingModal({
  open,
  onSubmit,
  accentColor = '#017C87',
  logoUrl,
  companyName,
  projectTitle,
  fontHeading,
}: GuestOnboardingModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => nameRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled])'
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [open, trapFocus]);

  if (!open) return null;

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const canSubmit = trimmedName.length > 0;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    if (trimmedEmail && !trimmedEmail.includes('@')) {
      setEmailError(true);
      return;
    }
    onSubmit(trimmedName, trimmedEmail);
  };

  const initial = (companyName?.trim()?.[0] ?? 'F').toUpperCase();
  const headingFont = fontHeading ? fontFamily(fontHeading) : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-onboard-title"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] overflow-hidden animate-[cardIn_220ms_cubic-bezier(0.22,0.61,0.36,1)]"
      >
        {/* Brand ribbon */}
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: accentColor }}
        />

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

          {/* Headline */}
          <h2
            id="guest-onboard-title"
            className="text-[22px] leading-tight font-semibold text-ink"
            style={{ fontFamily: headingFont }}
          >
            {projectTitle ? (
              <>
                Review <span className="text-dim font-medium">·</span>{' '}
                <span className="block mt-0.5 truncate">{projectTitle}</span>
              </>
            ) : (
              'Welcome'
            )}
          </h2>
          <p className="text-caption text-dim leading-relaxed mt-2">
            Add your name so the team knows who&rsquo;s leaving feedback. Email is
            optional — we&rsquo;ll only use it to notify you of replies.
          </p>

          {/* Inputs */}
          <div className="mt-5 space-y-2.5">
            <div className="relative">
              <input
                id="guest-name"
                ref={nameRef}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=" "
                className="peer w-full px-3.5 pt-5 pb-2 rounded-2xl bg-surface border border-edge-strong text-sm text-ink outline-none transition-all focus:bg-white focus:border-edge-hover focus:ring-2"
                style={{ ['--tw-ring-color' as string]: `${accentColor}25` }}
              />
              <label
                htmlFor="guest-name"
                className="absolute left-3.5 top-1.5 text-2xs uppercase tracking-wide font-medium text-faint transition-all pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-faint peer-focus:top-1.5 peer-focus:text-2xs peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-dim"
              >
                Your name
              </label>
            </div>

            <div className="relative">
              <input
                id="guest-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
                placeholder=" "
                className={`peer w-full px-3.5 pt-5 pb-2 rounded-2xl bg-surface border text-sm text-ink outline-none transition-all focus:bg-white focus:border-edge-hover focus:ring-2 ${
                  emailError ? 'border-red-300 focus:border-red-300' : 'border-edge-strong'
                }`}
                style={{ ['--tw-ring-color' as string]: emailError ? '#fecaca' : `${accentColor}25` }}
              />
              <label
                htmlFor="guest-email"
                className="absolute left-3.5 top-1.5 text-2xs uppercase tracking-wide font-medium text-faint transition-all pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-faint peer-focus:top-1.5 peer-focus:text-2xs peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-dim"
              >
                Email (optional)
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="group mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50"
            style={{ backgroundColor: accentColor }}
          >
            Continue
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0"
            />
          </button>

          {/* Footer */}
          <p className="mt-4 text-detail text-center text-faint">
            {companyName ? `An invitation from ${companyName}` : 'Private feedback space'}
          </p>
        </div>
      </form>
    </div>
  );
}
