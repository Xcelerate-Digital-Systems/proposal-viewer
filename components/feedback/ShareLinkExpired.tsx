'use client';

import { Clock } from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';

interface ShareLinkExpiredProps {
  /** Optional brand logo. */
  logoUrl?: string | null;
  /** Optional company name. */
  companyName?: string | null;
  /** Optional heading font. */
  fontHeading?: string | null;
  /** Accent color for the brand ribbon. */
  accentColor?: string;
}

/**
 * Shown when a share link has passed its expiration date.
 * Styled consistently with GuestOnboardingModal / ShareLinkPasswordGate.
 */
export default function ShareLinkExpired({
  logoUrl,
  companyName,
  fontHeading,
  accentColor = '#017C87',
}: ShareLinkExpiredProps) {
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

      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.2)] overflow-hidden animate-[cardIn_220ms_cubic-bezier(0.22,0.61,0.36,1)]">
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

          {/* Clock icon + heading */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Clock size={16} className="text-amber-600" />
            </div>
            <h2
              className="text-[22px] leading-tight font-semibold text-ink"
              style={{ fontFamily: headingFont }}
            >
              Link expired
            </h2>
          </div>
          <p className="text-caption text-dim leading-relaxed mt-2">
            This review link has expired and is no longer accessible.
          </p>

          {/* Contact message */}
          <div className="mt-5 px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-sm text-prose leading-relaxed">
              {companyName
                ? `Contact ${companyName} to request a new review link.`
                : 'Contact the sender to request a new review link.'}
            </p>
          </div>

          {/* Footer */}
          <p className="mt-5 text-detail text-center text-faint">
            {companyName ? `A review from ${companyName}` : 'Review link'}
          </p>
        </div>
      </div>
    </div>
  );
}
