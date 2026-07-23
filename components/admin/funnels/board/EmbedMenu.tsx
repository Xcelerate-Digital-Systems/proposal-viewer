'use client';

import { useState, useRef, useEffect } from 'react';
import { Code2, Check, Copy } from 'lucide-react';

interface Props {
  shareToken: string;
}

/**
 * Dropdown that generates an iframe embed code for the public funnel viewer.
 * Width and height are configurable; the code uses `?embed=true` so the
 * public viewer hides its header chrome for a cleaner embedded experience.
 */
export default function EmbedMenu({ shareToken }: Props) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('600');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.agencyviz.io';
  const src = `${baseUrl}/funnel/${shareToken}?embed=true`;
  const embedCode = `<iframe src="${src}" width="${width}" height="${height}" frameborder="0" style="border: none; border-radius: 8px;"></iframe>`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
        title="Embed code"
      >
        <Code2 size={13} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-[340px] bg-white border border-edge shadow-xl rounded-lg p-3 z-50 space-y-3">
          <div className="text-xs font-semibold text-ink">Embed funnel</div>
          <p className="text-2xs text-muted leading-snug">
            Copy this code and paste it into your website HTML to embed an
            interactive view of this funnel.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-2xs text-muted mb-1 block">Width</label>
              <input
                type="text"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full text-xs border border-edge rounded-lg px-2 py-1.5 outline-none focus:border-teal transition-colors"
                placeholder="100%"
              />
            </div>
            <div>
              <label className="text-2xs text-muted mb-1 block">Height (px)</label>
              <input
                type="text"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full text-xs border border-edge rounded-lg px-2 py-1.5 outline-none focus:border-teal transition-colors"
                placeholder="600"
              />
            </div>
          </div>

          <textarea
            readOnly
            value={embedCode}
            rows={3}
            className="w-full text-2xs font-mono text-muted bg-surface border border-edge rounded-lg p-2 resize-none outline-none"
            onFocus={(e) => e.target.select()}
          />

          <button
            type="button"
            onClick={copyCode}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-teal hover:bg-teal-hover rounded-lg px-3 py-2 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy embed code'}
          </button>
        </div>
      )}
    </div>
  );
}
