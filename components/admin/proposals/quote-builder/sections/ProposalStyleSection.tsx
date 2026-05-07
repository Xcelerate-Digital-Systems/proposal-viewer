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

/**
 * Heuristic for "currently active preset". A preset matches when its
 * background colour, style, and text colour all match the proposal — close
 * enough for the picker to highlight the right card.
 */
function detectActivePreset(proposal: Proposal): string | null {
  for (const preset of COVER_PRESETS) {
    if (preset.fromCompanyBrand) continue; // skip — needs company lookup
    const f = preset.fields;
    if (
      proposal.cover_bg_style === f.cover_bg_style &&
      (proposal.cover_bg_color_1 ?? '').toLowerCase() === f.cover_bg_color_1.toLowerCase() &&
      (proposal.cover_text_color ?? '').toLowerCase() === f.cover_text_color.toLowerCase()
    ) {
      return preset.id;
    }
  }
  return null;
}

export default function ProposalStyleSection({
  proposal,
  companyId,
  onSaved,
}: ProposalStyleSectionProps) {
  const toast = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const activeId = detectActivePreset(proposal);

  const applyPreset = async (preset: CoverPreset) => {
    setSavingId(preset.id);
    try {
      let fields: CoverPresetFields = preset.fields;

      // Custom Brand reads from the company's branding defaults.
      if (preset.fromCompanyBrand) {
        const { data: company } = await supabase
          .from('companies')
          .select('bg_primary, cover_button_text, cover_button_bg')
          .eq('id', companyId)
          .single();
        fields = {
          ...preset.fields,
          cover_bg_color_1: company?.bg_primary ?? preset.fields.cover_bg_color_1,
          cover_bg_color_2: company?.bg_primary ?? preset.fields.cover_bg_color_2,
          cover_button_bg: company?.cover_button_bg ?? preset.fields.cover_button_bg,
          cover_button_text_color:
            company?.cover_button_text ?? preset.fields.cover_button_text_color,
        };
      }

      const { error } = await supabase
        .from('proposals')
        .update(fields)
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
      description="Choose a pre-made cover style for your quote."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {COVER_PRESETS.map((preset) => {
          const isActive = activeId === preset.id;
          const isSaving = savingId === preset.id;
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
                className="aspect-[16/10] flex items-end p-3 relative"
                style={{ background: buildPreviewBackground(preset.fields) }}
              >
                {isActive && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-teal flex items-center justify-center shadow">
                    <Check size={12} />
                  </span>
                )}
                <div
                  className="space-y-1.5 w-full"
                  style={{ color: preset.fields.cover_text_color }}
                >
                  <div className="h-1.5 rounded-full w-1/4 bg-current opacity-60" />
                  <div className="h-1.5 rounded-full w-3/4 bg-current opacity-90" />
                  <div className="h-1.5 rounded-full w-1/2 bg-current opacity-50" />
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
