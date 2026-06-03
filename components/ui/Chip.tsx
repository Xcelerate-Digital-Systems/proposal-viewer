// components/ui/Chip.tsx
// Boolean "toggle" presented as a pill chip — same shape as the Quote tab's
// column-visibility chips and CoverDesignPanel's "Show on cover" / "Color
// overlay" controls. Used as the builder's canonical on/off control instead
// of a slidey Toggle.
'use client';

import { Check, X } from 'lucide-react';

interface ChipProps {
  enabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  /** When true, the chip stretches to fill its parent (useful inside grids). */
  block?: boolean;
}

export default function Chip({ enabled, onClick, children, disabled, block }: ChipProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
        block ? 'w-full' : ''
      } ${
        enabled
          ? 'bg-teal/10 border-teal/30 text-teal hover:bg-teal/15'
          : 'bg-surface border-edge-strong text-faint hover:text-prose hover:border-edge-hover'
      }`}
    >
      {enabled ? <Check size={11} className="shrink-0" /> : <X size={11} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}
