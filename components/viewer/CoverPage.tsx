// components/viewer/CoverPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { Proposal, supabase } from '@/lib/supabase';

interface CoverPageProps {
  proposal: Proposal;
  onStart: () => void;
}

export default function CoverPage({ proposal, onStart }: CoverPageProps) {
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

  // Fade in once ready
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const subtitle = proposal.cover_subtitle || `Prepared for ${proposal.client_name}`;
  const buttonText = proposal.cover_button_text || 'START READING PROPOSAL';

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
        {/* Logo */}
        <div>
          <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-7 md:h-8 opacity-90" />
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
            className="inline-flex items-center px-8 py-3.5 bg-white text-[#0f0f0f] text-sm font-semibold tracking-wider uppercase rounded-sm hover:bg-white/90 transition-colors"
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