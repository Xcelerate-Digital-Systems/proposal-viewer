'use client';

import { useEffect, useRef, useState } from 'react';

interface GuestOnboardingModalProps {
  open: boolean;
  /** Called with a trimmed name (required) and optional email. */
  onSubmit: (name: string, email: string) => void;
  /** Optional accent color for the submit button (defaults to the teal palette). */
  accentColor?: string;
}

/**
 * First-visit identity prompt for public review viewers. Matches the widget's
 * onboarding flow so a visitor only enters their name once per device.
 */
export default function GuestOnboardingModal({
  open,
  onSubmit,
  accentColor = '#017C87',
}: GuestOnboardingModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => nameRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

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

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center p-5 bg-slate-900/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-onboard-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[380px] bg-white rounded-2xl shadow-2xl p-6"
      >
        <h2 id="guest-onboard-title" className="text-lg font-semibold text-gray-900 mb-1.5">
          Welcome
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          Add your name so the team knows who&rsquo;s leaving feedback. Your email is
          optional and only used to notify you of replies.
        </p>

        <div className="mb-3">
          <label
            htmlFor="guest-name"
            className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1"
          >
            Your name
          </label>
          <input
            id="guest-name"
            ref={nameRef}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        </div>

        <div className="mb-5">
          <label
            htmlFor="guest-email"
            className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1"
          >
            Email <span className="ml-1 text-[10px] normal-case tracking-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="guest-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
            placeholder="jane@example.com"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm text-gray-900 outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal ${
              emailError ? 'border-red-400' : 'border-gray-200'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accentColor }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
