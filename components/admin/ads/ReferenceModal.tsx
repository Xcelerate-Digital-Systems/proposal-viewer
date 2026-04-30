// components/admin/ads/ReferenceModal.tsx
'use client';

import { X } from 'lucide-react';
import {
  AWARENESS_LEVELS,
  MARKET_SOPHISTICATION_LEVELS,
  AD_ANGLE_FAMILIES,
  AD_CREATIVE_FORMATS,
  AD_SIGNALS,
  AD_CREATIVE_STYLES,
} from '@/lib/ad-tracker/constants';

type ReferenceType =
  | 'awareness'
  | 'sophistication'
  | 'angle_families'
  | 'creative_formats'
  | 'signals'
  | 'creative_styles';

type Props = {
  type: ReferenceType;
  onClose: () => void;
};

const TITLES: Record<ReferenceType, string> = {
  awareness: 'Awareness Levels',
  sophistication: 'Market Sophistication',
  angle_families: 'Angle Families',
  creative_formats: 'Creative Format Menu',
  signals: 'Signal Reference',
  creative_styles: 'Creative Styles',
};

const DESCRIPTIONS: Record<ReferenceType, string> = {
  awareness: 'Eugene Schwartz\'s 5 stages of awareness — determines how much your prospect already knows about their problem and your solution.',
  sophistication: 'Describes how familiar your audience is with promises, solutions, and marketing claims in your category — guiding how bold, specific, or unique your message needs to be. As markets mature, simple claims stop working. Each level requires a new approach.',
  angle_families: 'Core angle categories for structuring your ad messaging. Each angle family represents a different psychological lever.',
  creative_formats: 'Available creative format types for your ads. Choose the format that best fits your angle and target audience.',
  signals: 'Where the idea or data for this ad originated. Tracking signals helps identify which sources produce the best-performing ads.',
  creative_styles: 'The visual and tonal style of the creative. This affects how the ad feels to the viewer.',
};

function AwarenessContent() {
  return (
    <div className="space-y-3">
      {AWARENESS_LEVELS.map((level, i) => (
        <div key={level.value} className="flex items-start gap-3 p-3 bg-surface rounded-lg">
          <div className="w-8 h-8 rounded-full bg-teal/10 text-teal flex items-center justify-center text-sm font-bold shrink-0">
            {i + 1}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink">{level.label}</p>
            <p className="text-[12px] text-muted mt-0.5">{level.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SophisticationContent() {
  return (
    <div className="space-y-4">
      {MARKET_SOPHISTICATION_LEVELS.map((level) => (
        <div key={level.value} className="p-4 bg-surface rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
              {level.level}
            </div>
            <p className="text-[13px] font-semibold text-ink">{level.label}</p>
          </div>
          <p className="text-[12px] text-muted">{level.description}</p>
          <div className="mt-2 pl-3 border-l-2 border-purple-200 space-y-1">
            <p className="text-[12px] text-ink"><span className="font-medium">What to do:</span> {level.whatToDo}</p>
            <p className="text-[12px] text-faint italic">{level.example}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AngleFamiliesContent() {
  return (
    <div className="space-y-3">
      {AD_ANGLE_FAMILIES.map((af) => (
        <div key={af.value} className="p-3 bg-surface rounded-lg">
          <p className="text-[13px] font-semibold text-ink">{af.label}</p>
          <p className="text-[12px] text-muted mt-0.5">{af.description}</p>
        </div>
      ))}
    </div>
  );
}

function CreativeFormatsContent() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AD_CREATIVE_FORMATS.map((cf) => (
        <div key={cf.value} className="p-2.5 bg-surface rounded-lg">
          <p className="text-[13px] font-medium text-ink">{cf.label}</p>
        </div>
      ))}
    </div>
  );
}

function SignalsContent() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AD_SIGNALS.map((s) => (
        <div key={s.value} className="p-2.5 bg-surface rounded-lg">
          <p className="text-[13px] font-medium text-ink">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function CreativeStylesContent() {
  return (
    <div className="space-y-2">
      {AD_CREATIVE_STYLES.map((cs) => (
        <div key={cs.value} className="p-2.5 bg-surface rounded-lg">
          <p className="text-[13px] font-medium text-ink">{cs.label}</p>
        </div>
      ))}
    </div>
  );
}

const CONTENT: Record<ReferenceType, () => JSX.Element> = {
  awareness: AwarenessContent,
  sophistication: SophisticationContent,
  angle_families: AngleFamiliesContent,
  creative_formats: CreativeFormatsContent,
  signals: SignalsContent,
  creative_styles: CreativeStylesContent,
};

export default function ReferenceModal({ type, onClose }: Props) {
  const Content = CONTENT[type];

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-ink">{TITLES[type]}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-[13px] text-muted mb-4">{DESCRIPTIONS[type]}</p>
          <Content />
        </div>
      </div>
    </div>
  );
}

export type { ReferenceType };
