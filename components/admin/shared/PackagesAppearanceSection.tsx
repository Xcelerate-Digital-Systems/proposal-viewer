// components/admin/shared/PackagesAppearanceSection.tsx
'use client';

import { Check, Circle, CheckCircle2, ArrowRight, Star, Minus } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import ColorPickerField from '@/components/ui/ColorPickerField';
import Slider from '@/components/ui/Slider';
import { PackageStyling, PackageFeatureIcon, PackageTier } from '@/lib/supabase';

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

  // The outer card + grey "Appearance" header were creating a nested-card
  // visual against the SectionCard the parent already wraps us in. Drop
  // them and stack each subsection with vertical dividers between groups
  // to match the Pricing Design layout. Reset action moves up to the
  // SectionCard's `action` slot (handled in PackagesDesignPanel).
  return (
    <div className="space-y-5 divide-y divide-gray-100 [&>*:not(:first-child)]:pt-5">

      {/* ── Title colour ──────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Title</label>
        <ColorPickerField
          label="Title text colour"
          value={styling.title_color}
          fallback="#ffffff"
          onChange={(v) => update({ title_color: v })}
          onReset={() => update({ title_color: null })}
        />
      </div>

      {/* ── Card Background ───────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Card Background</label>
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
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Card Text</label>
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
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Recommended Badge</label>
        <ColorPickerField
          label="Badge text"
          value={styling.recommended_text_color}
          fallback="#ffffff"
          onChange={(v) => update({ recommended_text_color: v })}
          onReset={() => update({ recommended_text_color: null })}
        />
      </div>

      {/* ── Feature Icon ──────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Feature Icon</label>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => update({ feature_icon: opt.key })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                styling.feature_icon === opt.key
                  ? 'border-teal bg-teal/5 text-teal'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
              }`}
              title={opt.label}
            >
              {opt.icon}
              <span className="text-2xs font-medium leading-none">{opt.label}</span>
            </button>
          ))}
        </div>
        <ColorPickerField
          label="Icon colour"
          value={styling.feature_icon_color}
          fallback="#01434A"
          onChange={(v) => update({ feature_icon_color: v })}
          onReset={() => update({ feature_icon_color: null })}
        />
      </div>

      {/* ── Accent Bar ───────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Accent Bar</label>
        <ColorPickerField
          label="Top border bar"
          value={styling.accent_bar_color}
          fallback="#01434A"
          onChange={(v) => update({ accent_bar_color: v })}
          onReset={() => update({ accent_bar_color: null })}
        />
      </div>

      {/* ── Price ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Price</label>
        <ColorPickerField
          label="Price text"
          value={styling.price_color}
          fallback="#01434A"
          onChange={(v) => update({ price_color: v })}
          onReset={() => update({ price_color: null })}
        />
      </div>

      {/* ── Card Shape ────────────────────────────────────── */}
      <div className="space-y-4">
        <label className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Card Shape</label>
        <Slider
          label="Border radius"
          value={styling.border_radius}
          max={24}
          formatValue={(v) => `${v}px`}
          onChange={(v) => update({ border_radius: v })}
        />
        <Slider
          label="Border thickness"
          value={styling.border_width}
          max={4}
          formatValue={(v) => `${v}px`}
          onChange={(v) => update({ border_width: v })}
        />
      </div>

    </div>
  );
}

export function isDefaultPackageStyling(s: PackageStyling): boolean {
  return (
    !s.title_color &&
    !s.card_bg_color &&
    !s.card_bg_independent &&
    !s.card_text_color &&
    !s.card_text_independent &&
    !s.recommended_text_color &&
    !s.recommended_bg_color &&
    s.feature_icon === 'dot' &&
    !s.feature_icon_color &&
    !s.accent_bar_color &&
    !s.price_color &&
    s.border_radius === 12 &&
    s.border_width === 1
  );
}