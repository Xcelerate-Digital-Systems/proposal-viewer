// components/admin/ads/NamingLegendPanel.tsx
'use client';

import { X, BookOpen } from 'lucide-react';

type Props = {
  onClose: () => void;
};

const SEGMENT_CODES = [
  {
    code: 'OFFER',
    description: 'The offer or hook — what the ad is selling or the angle it leads with',
    examples: 'FREE-TRIAL, SAVE50, SOCIAL-PROOF',
  },
  {
    code: 'C01–C99',
    description: 'Primary text / copy variant number',
    examples: 'C01, C02, C03',
  },
  {
    code: 'H01–H99',
    description: 'Headline variant number',
    examples: 'H01, H02',
  },
  {
    code: 'D01–D99',
    description: 'Description variant number',
    examples: 'D01, D02',
  },
  {
    code: 'IMG / VID / CAR / STR / GIF',
    description: 'Creative format (image, video, carousel, story/reel, GIF/motion)',
    examples: 'IMG01a, VID02b, CAR01a',
  },
  {
    code: 'a–z (suffix)',
    description: 'Sub-variant of the same creative asset',
    examples: 'IMG01a, IMG01b, IMG01c',
  },
];

const FORMAT_CODES = [
  { code: 'IMG', label: 'Static image' },
  { code: 'VID', label: 'Video' },
  { code: 'CAR', label: 'Carousel' },
  { code: 'STR', label: 'Story / Reel (vertical)' },
  { code: 'GIF', label: 'GIF / Motion graphic' },
];

export default function NamingLegendPanel({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
              <BookOpen size={16} className="text-teal" />
            </div>
            <h2 className="text-base font-semibold text-ink">Ad Naming Convention</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Format example */}
          <div>
            <h3 className="text-[13px] font-semibold text-ink mb-2">Format</h3>
            <div className="bg-surface rounded-xl px-4 py-3 font-mono text-[13px] text-ink tracking-wide">
              [OFFER]-C01-H01-D01-IMG01a
            </div>
            <p className="text-[12px] text-faint mt-2">
              Each segment is separated by a dash. Use two-digit numbers for all variants (01, not 1).
            </p>
          </div>

          {/* Segment legend */}
          <div>
            <h3 className="text-[13px] font-semibold text-ink mb-2">Segment Legend</h3>
            <div className="rounded-xl border border-edge overflow-hidden">
              {SEGMENT_CODES.map((row, i) => (
                <div
                  key={row.code}
                  className={`flex gap-4 px-4 py-3 ${i < SEGMENT_CODES.length - 1 ? 'border-b border-edge' : ''}`}
                >
                  <span className="font-mono text-[12px] text-teal shrink-0 w-[120px] pt-0.5">
                    {row.code}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">{row.description}</p>
                    <p className="text-[12px] text-faint mt-0.5">{row.examples}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Creative format codes */}
          <div>
            <h3 className="text-[13px] font-semibold text-ink mb-2">Creative Format Codes</h3>
            <div className="rounded-xl border border-edge overflow-hidden">
              {FORMAT_CODES.map((row, i) => (
                <div
                  key={row.code}
                  className={`flex items-center gap-4 px-4 py-2.5 ${i < FORMAT_CODES.length - 1 ? 'border-b border-edge' : ''}`}
                >
                  <span className="font-mono text-[12px] text-teal w-[48px] shrink-0">{row.code}</span>
                  <span className="text-[13px] text-muted">{row.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div>
            <h3 className="text-[13px] font-semibold text-ink mb-2">Examples</h3>
            <div className="space-y-2">
              {[
                { name: 'FREE-TRIAL-C01-H01-D01-VID01a', note: 'Free trial offer, copy 1, headline 1, description 1, video 1a' },
                { name: 'SAVE50-C02-H01-D01-IMG01b', note: '50% off offer, copy 2, headline 1, description 1, image 1b' },
                { name: 'SOCIAL-PROOF-C01-H02-D01-CAR01a', note: 'Social proof hook, copy 1, headline 2, description 1, carousel 1a' },
              ].map((ex) => (
                <div key={ex.name} className="bg-surface rounded-xl px-4 py-3">
                  <p className="font-mono text-[12px] text-ink">{ex.name}</p>
                  <p className="text-[12px] text-faint mt-0.5">{ex.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-muted hover:text-ink rounded-lg hover:bg-surface transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
