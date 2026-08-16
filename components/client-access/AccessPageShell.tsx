'use client';

import { Shield } from 'lucide-react';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

interface AccessPageShellProps {
  agencyName: string;
  logoUrl: string | null;
  accentColor: string;
  bgPrimary: string;
  bgSecondary: string;
  fontHeading: string | null;
  fontBody: string | null;
  clientName: string | null;
  notes: string | null;
  children: React.ReactNode;
}

export default function AccessPageShell({
  agencyName,
  logoUrl,
  accentColor,
  bgPrimary,
  bgSecondary,
  fontHeading,
  fontBody,
  clientName,
  notes,
  children,
}: AccessPageShellProps) {
  const fonts = [fontHeading, fontBody].filter(Boolean) as string[];

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: bgSecondary,
        fontFamily: fontBody ? `"${fontBody}", sans-serif` : 'var(--font-geist-sans), sans-serif',
      }}
    >
      {fonts.length > 0 && <GoogleFontLoader fonts={fonts} />}

      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Agency header */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={agencyName}
              className="h-10 sm:h-12 mx-auto mb-4 object-contain"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: accentColor }}
            >
              {agencyName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1
            className="text-xl sm:text-2xl font-bold text-white"
            style={{ fontFamily: fontHeading ? `"${fontHeading}", sans-serif` : undefined }}
          >
            {clientName ? `Hi ${clientName}` : 'Connect Your Accounts'}
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {agencyName} needs access to the platforms below to manage your accounts.
            Click each one to connect securely.
          </p>
        </div>

        {/* Notes from agency */}
        {notes && (
          <div
            className="rounded-xl p-4 mb-6 text-sm text-gray-300"
            style={{ backgroundColor: '#ffffff08', borderLeft: `3px solid ${accentColor}` }}
          >
            {notes}
          </div>
        )}

        {/* Platform cards */}
        <div className="space-y-3">
          {children}
        </div>

        {/* Security footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Shield size={14} />
          <span>Secure connection — your credentials are never shared</span>
        </div>

        {/* Powered by */}
        <div className="mt-4 text-center">
          <span className="text-[10px] text-gray-600">
            Powered by AgencyViz
          </span>
        </div>
      </div>
    </div>
  );
}
