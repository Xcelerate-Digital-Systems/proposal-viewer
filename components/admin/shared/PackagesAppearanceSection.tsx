// components/admin/shared/PackagesAppearanceSection.tsx
'use client';

import { Check, Circle, CheckCircle2, ArrowRight, Star, Minus, RotateCcw } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import ColorPickerField from '@/components/ui/ColorPickerField';
import { PackageStyling, PackageFeatureIcon, PackageTier, DEFAULT_PACKAGE_STYLING } from '@/lib/supabase';

interface PackagesAppearanceSectionProps {
  styling: PackageStyling;
  tiers: PackageTier[];
  onStylingChange: (styling: PackageStyling) => void;
  onTierChange: (tierId: string, changes: Partial<PackageTier>) => void;
}

const ICON_OPTIONS: { key: PackageFeatureIcon; label: string; icon: React.ReactNode }[] = [
  { key: 'dot', label: 'Dot', icon: <Circle size={12} className="fill-current" /> },
  { key: 'check', label: 'Check', icon: <Check size={12} strokeWidth={3} /> },
  { key: 'checkCircle', label: 'Circle Check', icon: <CheckCircle2 size={12} /> },
  { key: 'arrow', label: 'Arrow', icon: <ArrowRight size={12} strokeWidth={3} /> },
  { key: 'star', label: 'Star', icon: <Star size={12} className="fill-current" strokeWidth={0} /> },
  { key: 'dash', label: 'Dash', icon: <Minus size={12} strokeWidth={3} /> },
];

export default function PackagesAppearanceSection({
  styling,
  tiers,
  onStylingChange,
  onTierChange,
}: PackagesAppearanceSectionProps) {
  const update = (changes: Partial<PackageStyling>) => {
    onStylingChange({ ...styling, ...changes });
  };

  const resetAll = () => {
    onStylingChange({ ...DEFAULT_PACKAGE_STYLING });
  };

  return (
    <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Appearance</label>
        {!isDefault(styling) && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#017C87] transition-colors"
          >
            <RotateCcw size={10} />
            Reset to defaults
          </button>
        )}
      </div>

      {/* ── Title colour ──────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Title</label>
        <ColorPickerField
          label="Title text colour"
          value={styling.title_color}
          fallback="#ffffff"
          onChange={(v) => update({ title_color: v })}
          onReset={() => update({ title_color: null })}
        />
      </div>

      {/* ── Card Background ───────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Card Background</label>
        <ColorPickerField
          label="All cards"
          value={styling.card_bg_color}
          fallback="#141414"
          onChange={(v) => update({ card_bg_color: v })}
          onReset={() => update({ card_bg_color: null })}
        />
        <div className="flex items-center justify-between pt-1">
          <label className="text-xs text-gray-600">Independent per card</label>
          <Toggle
            enabled={styling.card_bg_independent}
            onChange={() => update({ card_bg_independent: !styling.card_bg_independent })}
          />
        </div>
        {styling.card_bg_independent && tiers.length > 0 && (
          <div className="ml-3 pl-3 border-l-2 border-gray-100 space-y-2 pt-1">
            {tiers.map((tier) => (
              <ColorPickerField
                key={tier.id}
                label={tier.name || 'Unnamed'}
                value={tier.card_bg_color ?? null}
                fallback={styling.card_bg_color || '#141414'}
                onChange={(v) => onTierChange(tier.id, { card_bg_color: v })}
                onReset={() => onTierChange(tier.id, { card_bg_color: null })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Card Text ─────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Card Text</label>
        <ColorPickerField
          label="All cards"
          value={styling.card_text_color}
          fallback="#ffffff"
          onChange={(v) => update({ card_text_color: v })}
          onReset={() => update({ card_text_color: null })}
        />
        <div className="flex items-center justify-between pt-1">
          <label className="text-xs text-gray-600">Independent per card</label>
          <Toggle
            enabled={styling.card_text_independent}
            onChange={() => update({ card_text_independent: !styling.card_text_independent })}
          />
        </div>
        {styling.card_text_independent && tiers.length > 0 && (
          <div className="ml-3 pl-3 border-l-2 border-gray-100 space-y-2 pt-1">
            {tiers.map((tier) => (
              <ColorPickerField
                key={tier.id}
                label={tier.name || 'Unnamed'}
                value={tier.card_text_color ?? null}
                fallback={styling.card_text_color || '#ffffff'}
                onChange={(v) => onTierChange(tier.id, { card_text_color: v })}
                onReset={() => onTierChange(tier.id, { card_text_color: null })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Recommended Badge ─────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recommended Badge</label>
        <ColorPickerField
          label="Badge text"
          value={styling.recommended_text_color}
          fallback="#ffffff"
          onChange={(v) => update({ recommended_text_color: v })}
          onReset={() => update({ recommended_text_color: null })}
        />
      </div>

      {/* ── Feature Icon ──────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Feature Icon</label>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => update({ feature_icon: opt.key })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                styling.feature_icon === opt.key
                  ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
              }`}
              title={opt.label}
            >
              {opt.icon}
              <span className="text-[9px] font-medium leading-none">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Card Shape ────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-3">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Card Shape</label>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Border radius</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={styling.border_radius}
              onChange={(e) => update({ border_radius: Number(e.target.value) })}
              className="flex-1 h-1 accent-[#017C87]"
            />
            <span className="text-[10px] text-gray-500 font-mono w-[32px] text-right">
              {styling.border_radius}px
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Border thickness</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={styling.border_width}
              onChange={(e) => update({ border_width: Number(e.target.value) })}
              className="flex-1 h-1 accent-[#017C87]"
            />
            <span className="text-[10px] text-gray-500 font-mono w-[32px] text-right">
              {styling.border_width}px
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

function isDefault(s: PackageStyling): boolean {
  return (
    !s.title_color &&
    !s.card_bg_color &&
    !s.card_bg_independent &&
    !s.card_text_color &&
    !s.card_text_independent &&
    !s.recommended_text_color &&
    !s.recommended_bg_color &&
    s.feature_icon === 'dot' &&
    s.border_radius === 12 &&
    s.border_width === 1
  );
}