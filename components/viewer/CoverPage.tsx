// components/viewer/CoverPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Proposal, supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';

interface CoverPageProps {
  proposal: Proposal;
  branding: CompanyBranding;
  onStart: () => void;
}

export default function CoverPage({ proposal, branding, onStart }: CoverPageProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (proposal.cover_image_path) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(proposal.cover_image_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setBgUrl(data.signedUrl);
        });
    }
  }, [proposal.cover_image_path]);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const subtitle = proposal.cover_subtitle || `Prepared for ${proposal.client_name}`;
  const buttonText = proposal.cover_button_text || 'START READING PROPOSAL';
  const accent = branding.accent_color || '#ff6700';

  return (
    <div
      className={`h-screen w-screen flex flex-col justify-between relative overflow-hidden transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Background image */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full px-10 py-10 md:px-16 md:py-14">
        {/* Company logo / name */}
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.name}
              className="h-8 md:h-10 max-w-[200px] object-contain"
            />
          ) : branding.name ? (
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-white/70" />
              <span className="text-white/90 text-sm md:text-base font-medium">{branding.name}</span>
            </div>
          ) : (
            <img src="/logo-white.svg" alt="Logo" className="h-7 md:h-8 opacity-90" />
          )}
        </div>

        {/* Title area */}
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-tight mb-4 font-[family-name:var(--font-display)]">
            {proposal.title}
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-8">
            {subtitle}
          </p>
          <button
            onClick={onStart}
            className="inline-flex items-center px-8 py-3.5 text-sm font-semibold tracking-wider uppercase rounded-sm transition-colors"
            style={{ backgroundColor: accent, color: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {buttonText}
          </button>
        </div>

        {/* Bottom spacer */}
        <div />
      </div>
    </div>
  );
}