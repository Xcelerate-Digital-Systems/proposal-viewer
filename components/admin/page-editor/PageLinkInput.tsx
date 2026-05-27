// components/admin/page-editor/PageLinkInput.tsx
'use client';

import { useState } from 'react';
import { Link2, X } from 'lucide-react';

interface PageLinkInputProps {
  linkUrl: string;
  linkLabel: string;
  onChange: (url: string, label: string) => void;
  /** Teal-tinted variant (for pricing/text rows) vs neutral (for PDF rows) */
  variant?: 'neutral' | 'teal';
}

export default function PageLinkInput({ linkUrl, linkLabel, onChange, variant = 'neutral' }: PageLinkInputProps) {
  const [expanded, setExpanded] = useState(false);
  const hasLink = !!linkUrl.trim();

  const teal = variant === 'teal';

  return (
    <div className="w-full" onClick={(e) => e.stopPropagation()}>
      {/* Toggle button — inline with the row */}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        title={hasLink ? 'Edit external link' : 'Add external link'}
        className={`shrink-0 p-1.5 rounded-lg flex items-center justify-center border transition-colors ${
          hasLink
            ? 'text-teal bg-teal/10 border-teal/30 hover:bg-teal/20'
            : teal
            ? 'text-teal/40 border-transparent hover:text-teal hover:bg-teal/10'
            : 'text-gray-300 border-edge hover:text-teal hover:border-teal/25 hover:bg-teal/5'
        }`}
      >
        <Link2 size={13} />
      </button>

      {/* Expandable link inputs */}
      {expanded && (
        <div className="mt-1.5 ml-0 p-2.5 rounded-lg bg-surface border border-edge-strong space-y-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Link2 size={11} className="text-teal" />
            <span className="text-2xs font-semibold text-teal uppercase tracking-wide">External Link</span>
            {hasLink && (
              <button
                onClick={() => { onChange('', ''); }}
                className="ml-auto text-2xs text-red-400 hover:text-red-500 flex items-center gap-0.5"
              >
                <X size={10} /> Remove
              </button>
            )}
          </div>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => onChange(e.target.value, linkLabel)}
            placeholder="https://example.com/resource"
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge-strong bg-white text-ink text-xs focus:outline-none focus:border-teal/40 placeholder:text-faint"
          />
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => onChange(linkUrl, e.target.value)}
            placeholder="Button label (e.g. View Case Study)"
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge-strong bg-white text-ink text-xs focus:outline-none focus:border-teal/40 placeholder:text-faint"
          />
        </div>
      )}
    </div>
  );
}