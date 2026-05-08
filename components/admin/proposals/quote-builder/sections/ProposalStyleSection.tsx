// components/admin/proposals/quote-builder/sections/ProposalStyleSection.tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import {
  COVER_PRESETS,
  type CoverPreset,
  type CoverPresetFields,
  resolveCustomBrand,
} from '@/lib/proposal-templates/cover-presets';
import SectionCard from '../SectionCard';

interface ProposalStyleSectionProps {
  proposal: Proposal;
  companyId: string;
  onSaved: () => void;
}

function buildPreviewBackground(fields: CoverPresetFields): string {
  if (fields.cover_bg_style === 'solid') return fields.cover_bg_color_1;
  const angle = fields.cover_gradient_angle ?? 135;
  return `linear-gradient(${angle}deg, ${fields.cover_bg_color_1}, ${fields.cover_bg_color_2})`;
}

export default function ProposalStyleSection({
  proposal,
  companyId,
  onSaved,
}: ProposalStyleSectionProps) {
  const toast = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  // Active preset is now stored explicitly on the proposal — much more
  // reliable than trying to infer it from cover colours.
  const activeId = proposal.cover_preset_id;

  const applyPreset = async (preset: CoverPreset) => {
    setSavingId(preset.id);
    try {
      let fields: CoverPresetFields = preset.fields;

      if (preset.fromCompanyBrand) {
        const { data: company } = await supabase
          .from('companies')
          .select('accent_color, cover_button_text, cover_button_bg')
          .eq('id', companyId)
          .single();
        fields = resolveCustomBrand(preset.fields, company ?? {});
      }

      const { error } = await supabase
        .from('proposals')
        .update({ ...fields, cover_preset_id: preset.id })
        .eq('id', proposal.id);

      if (error) throw error;
      toast.success(`Style "${preset.label}" applied`);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply style');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SectionCard
      title="Proposal Style"
      description="Choose a pre-made cover style for your quote. Pick Custom Brand to use your company's accent colour."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {COVER_PRESETS.map((preset) => {
          const isActive = activeId === preset.id;
          const isSaving = savingId === preset.id;
          // For Custom Brand, the preview card uses the literals — once
          // applied to a quote it'll re-render against the real brand row.
          const cardBg = buildPreviewBackground(preset.fields);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={isSaving}
              className={`group text-left rounded-lg overflow-hidden border-2 transition-all ${
                isActive
                  ? 'border-teal ring-2 ring-teal/20'
                  : 'border-gray-200 hover:border-gray-300'
              } ${isSaving ? 'opacity-60' : ''}`}
            >
              <div
                className="aspect-[16/10] flex flex-col justify-between p-3 relative"
                style={{ background: cardBg }}
              >
                {/* Subtle radial highlight to give the card depth */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 75% 25%, rgba(255,255,255,0.18), transparent 55%)',
                  }}
                />
                {isActive && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-teal flex items-center justify-center shadow z-10">
                    <Check size={12} />
                  </span>
                )}
                {/* Top-row tiny "QUOTE" tag — mirrors what shows in the cover */}
                <div
                  className="relative z-10 text-[7px] font-medium tracking-[0.2em] uppercase opacity-60"
                  style={{ color: preset.fields.cover_text_color }}
                >
                  Quote
                </div>
                {/* Sample title + total — gives a real feel for the preset */}
                <div className="relative z-10" style={{ color: preset.fields.cover_text_color }}>
                  <div
                    className="text-[11px] font-semibold leading-tight tracking-tight mb-1"
                    style={{ fontFamily: 'inherit' }}
                  >
                    Bathroom Renovation
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-[6px] opacity-60 tracking-[0.18em] uppercase">Total</div>
                    <div className="text-[10px] font-semibold tabular-nums opacity-90">
                      $24,200
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-3 py-2 bg-white">
                <div
                  className={`text-sm font-medium ${
                    isActive ? 'text-teal' : 'text-gray-900'
                  }`}
                >
                  {preset.label}
                </div>
                <div className="text-xs text-gray-400">{preset.caption}</div>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
