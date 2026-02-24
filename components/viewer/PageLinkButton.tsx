// components/viewer/PageLinkButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface PageLinkButtonProps {
  url: string;
  label?: string;
  accentColor?: string;
}

export default function PageLinkButton({ url, label, accentColor = '#ff6700' }: PageLinkButtonProps) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount / when url changes
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => {
      clearTimeout(t);
      setVisible(false);
    };
  }, [url]);

  // Ensure the URL has a protocol
  const href = url.startsWith('http') ? url : `https://${url}`;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex justify-center pointer-events-none transition-all duration-300 ease-out"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
      }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto mt-3 flex items-center gap-2.5 pl-4 pr-3.5 py-2 rounded-full shadow-lg text-sm font-medium transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
        style={{
          backgroundColor: accentColor,
          color: '#ffffff',
        }}
      >
        <span className="max-w-[280px] truncate">{label || 'View Resource'}</span>
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          <ExternalLink size={11} className="shrink-0" />
        </span>
      </a>
    </div>
  );
}