// components/admin/company/DerivedPaletteSection.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, Check, Copy } from 'lucide-react';
import type { BrandPalette } from '@/lib/branding';

const CHECKER_BG =
  'repeating-conic-gradient(#e5e5e5 0% 25%, transparent 0% 50%) 0 0 / 8px 8px';

interface TokenDef {
  key: keyof BrandPalette;
  label: string;
  hint: string;
  hasAlpha?: boolean;
}

const ACCENT_TOKENS: TokenDef[] = [
  { key: 'accent', label: 'Accent', hint: 'Primary brand colour — buttons, links, highlights' },
  { key: 'accentHover', label: 'Hover', hint: 'Hover state for buttons and links' },
  { key: 'accentActive', label: 'Active', hint: 'Pressed / active state' },
  { key: 'accentTint', label: 'Tint', hint: 'Very light shade for badge backgrounds' },
  { key: 'accentMuted', label: 'Muted', hint: 'Secondary elements at 40% opacity', hasAlpha: true },
  { key: 'accentBorder', label: 'Border', hint: 'Focus rings and card accents at 19% opacity', hasAlpha: true },
  { key: 'accentSurface', label: 'Surface', hint: 'Selected row backgrounds at 6% opacity', hasAlpha: true },
];

const BG_TOKENS: TokenDef[] = [
  { key: 'bg', label: 'Background', hint: 'Page background' },
  { key: 'bgElevated', label: 'Elevated', hint: 'Sidebar and elevated panel surfaces' },
  { key: 'bgCard', label: 'Card', hint: 'Card backgrounds' },
  { key: 'surface', label: 'Surface', hint: 'Mid-tone surface between bg and card' },
  { key: 'border', label: 'Border', hint: 'Panel and card borders' },
  { key: 'borderSubtle', label: 'Subtle', hint: 'Subtle separators and dividers' },
];

const TEXT_TOKENS: TokenDef[] = [
  { key: 'mutedText', label: 'Muted', hint: 'Secondary text with less emphasis' },
  { key: 'faintText', label: 'Faint', hint: 'Tertiary text — timestamps, hints' },
  { key: 'sidebarText', label: 'Light text', hint: 'Primary text on dark panels (pass-through)' },
  { key: 'acceptText', label: 'Button text', hint: 'CTA button text colour (pass-through)' },
];

interface Props {
  palette: BrandPalette;
}

export default function DerivedPaletteSection({ palette }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyHex = (key: string, hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-2xs text-faint hover:text-muted transition-colors w-full"
      >
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? '' : '-rotate-90'}`}
        />
        <span className="font-medium">Derived palette</span>
        <span className="text-faint">— 17 auto-generated shades</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border border-edge rounded-lg p-3 bg-surface/50">
          <TokenGroup label="Accent" tokens={ACCENT_TOKENS} palette={palette} copiedKey={copiedKey} onCopy={copyHex} />
          <TokenGroup label="Background" tokens={BG_TOKENS} palette={palette} copiedKey={copiedKey} onCopy={copyHex} />
          <TokenGroup label="Text" tokens={TEXT_TOKENS} palette={palette} copiedKey={copiedKey} onCopy={copyHex} />
        </div>
      )}
    </div>
  );
}

function TokenGroup({
  label,
  tokens,
  palette,
  copiedKey,
  onCopy,
}: {
  label: string;
  tokens: TokenDef[];
  palette: BrandPalette;
  copiedKey: string | null;
  onCopy: (key: string, hex: string) => void;
}) {
  return (
    <div>
      <span className="text-2xs font-semibold text-faint uppercase tracking-wider">{label}</span>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
        {tokens.map((t) => {
          const hex = String(palette[t.key]);
          const isCopied = copiedKey === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onCopy(t.key, hex)}
              className="flex items-center gap-2 py-0.5 group rounded hover:bg-edge/50 transition-colors text-left"
              title={t.hint}
            >
              <div
                className="w-5 h-5 rounded-md border border-edge shrink-0"
                style={{
                  background: t.hasAlpha ? CHECKER_BG : undefined,
                }}
              >
                <div
                  className="w-full h-full rounded-md"
                  style={{ backgroundColor: hex }}
                />
              </div>
              <span className="text-2xs text-dim truncate flex-1">{t.label}</span>
              <span className="text-2xs font-mono text-faint group-hover:text-muted transition-colors">
                {isCopied ? (
                  <span className="flex items-center gap-0.5 text-emerald-500">
                    <Check size={10} /> Copied
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <Copy size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    {hex.slice(0, 7)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
