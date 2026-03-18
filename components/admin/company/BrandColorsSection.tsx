// components/admin/company/BrandColorsSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Palette, Plus } from 'lucide-react';
import ColorPickerField from '@/components/ui/ColorPickerField';

const MAX_BRAND_COLORS = 12;
const DEFAULT_NEW_COLOR = '#6366f1'; // visible indigo so new swatches are obvious

interface BrandColorsSectionProps {
  isOwner: boolean;
  saving: string | null;
  brandColors: string[];
  setBrandColors: (colors: string[]) => void;
  lastSaved?: boolean;
  saveError?: string | null;
}

export default function BrandColorsSection({
  isOwner,
  saving,
  brandColors,
  setBrandColors,
  lastSaved,
  saveError,
}: BrandColorsSectionProps) {
  // Track the index of a freshly-added swatch so we can auto-open its picker
  const [newIndex, setNewIndex] = useState<number | null>(null);

  // Clear auto-open flag once that index has mounted and opened
  useEffect(() => {
    if (newIndex !== null) setNewIndex(null);
  }, [brandColors.length]); // reset whenever the list length changes  // eslint-disable-line react-hooks/exhaustive-deps

  const handleColorChange = (index: number, hex: string) => {
    const next = [...brandColors];
    next[index] = hex;
    setBrandColors(next);
  };

  const handleRemove = (index: number) => {
    setBrandColors(brandColors.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (brandColors.length >= MAX_BRAND_COLORS) return;
    const idx = brandColors.length;
    setBrandColors([...brandColors, DEFAULT_NEW_COLOR]);
    setNewIndex(idx);
  };

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-faint" />
          <span className="text-sm font-medium text-muted">Brand Colors</span>
        </div>
        {isOwner && saving === 'brand_colors' && (
          <span className="flex items-center gap-1.5 text-xs text-faint">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {isOwner && lastSaved && saving !== 'brand_colors' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <p className="text-xs text-faint mb-4">
        Define your core brand palette. These colours appear in every colour picker across the app.
      </p>

      {saveError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
          Could not save: {saveError}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {brandColors.map((color, i) => (
          <div key={i} className="relative group">
            <ColorPickerField
              swatchOnly
              defaultOpen={i === newIndex}
              label={`Brand colour ${i + 1}`}
              value={color}
              fallback={DEFAULT_NEW_COLOR}
              onChange={(hex) => handleColorChange(i, hex)}
              disabled={!isOwner}
            />
            {/* Remove button */}
            {isOwner && (
              <button
                onClick={() => handleRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                title="Remove"
              >
                <span className="text-[9px] font-bold leading-none">×</span>
              </button>
            )}
          </div>
        ))}

        {/* Add button */}
        {isOwner && brandColors.length < MAX_BRAND_COLORS && (
          <button
            onClick={handleAdd}
            className="w-9 h-9 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-teal/40 hover:text-teal transition-colors"
            title="Add colour"
          >
            <Plus size={14} />
          </button>
        )}

        {brandColors.length === 0 && !isOwner && (
          <span className="text-xs text-faint italic">No brand colours defined</span>
        )}
      </div>

      {brandColors.length > 0 && (
        <p className="text-[10px] text-faint mt-3">
          Click a swatch to edit. Hover to remove.
        </p>
      )}
    </div>
  );
}
