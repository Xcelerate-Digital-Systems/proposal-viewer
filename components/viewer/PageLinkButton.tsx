// components/viewer/PageLinkButton.tsx
'use client';

import { ExternalLink } from 'lucide-react';

interface PageLinkButtonProps {
  url: string;
  label?: string;
  accentColor?: string;
}

export default function PageLinkButton({ url, label, accentColor = '#ff6700' }: PageLinkButtonProps) {
  // Ensure the URL has a protocol
  const href = url.startsWith('http') ? url : `https://${url}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-16 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-all hover:scale-105 hover:shadow-xl active:scale-95"
      style={{
        backgroundColor: accentColor,
        color: '#ffffff',
      }}
    >
      <span className="max-w-[200px] truncate">{label || 'View Resource'}</span>
      <ExternalLink size={14} className="shrink-0 opacity-80" />
    </a>
  );
}