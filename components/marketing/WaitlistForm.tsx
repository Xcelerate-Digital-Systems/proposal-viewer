// components/marketing/WaitlistForm.tsx
// Email + agency-name capture for /pricing while public signup is gated.
// Posts to /api/waitlist (unauthenticated, rate-limited per IP).

'use client';

import { useState } from 'react';
import { ArrowRight, Check } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { useAnalytics } from '@/hooks/useAnalytics';

interface WaitlistFormProps {
  source: string;
}

export function WaitlistForm({ source }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { track } = useAnalytics();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          agency_name: agencyName.trim() || undefined,
          source,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Try again.');
        setSubmitting(false);
        return;
      }
      track('waitlist_joined', { source, has_agency_name: agencyName.trim().length > 0 });
      setDone(true);
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-teal/5 border border-teal/20 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center mx-auto mb-3">
          <Check size={20} weight="duotone" className="text-teal" />
        </div>
        <h3 className="text-base font-semibold text-ink mb-1">You&apos;re on the list</h3>
        <p className="text-sm text-muted">
          We&apos;ll be in touch the moment AgencyViz opens for new agencies.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-muted text-center">
        Public signup is invite-only right now. Join the waitlist and we&apos;ll let
        you in as soon as we open the doors.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          type="email"
          placeholder="you@youragency.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
        />
        <input
          type="text"
          placeholder="Agency name (optional)"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          maxLength={120}
          className="px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={submitting}
        rightIcon={ArrowRight}
      >
        Join the waitlist
      </Button>
    </form>
  );
}
