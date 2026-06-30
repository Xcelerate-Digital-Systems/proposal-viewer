'use client';

import { X, Check } from 'lucide-react';
import type { FeedbackItem } from '@/lib/supabase';
import { FUNNEL_COLOR_PRESETS } from '@/lib/types/funnel';
import { NODE_LAYOUTS } from './nodes/nodeConfig';

const TYPE_LABELS: Record<string, string> = {
  webpage: 'Website', image: 'Image', video: 'Video', pdf: 'PDF',
  email: 'Email', sms: 'SMS', ad: 'Ad',
  google_search_ad: 'Google Ad', google_banner_ad: 'Google Ad',
  meta_lead_form: 'Lead Form',
};

const DEFAULT_TINTS: Record<string, string> = {
  email: '#EF4444',
  sms: '#10B981',
  ad: '#DBEAFE',
  google_search_ad: '#FEF3C7',
  google_banner_ad: '#FEF3C7',
};

interface Props {
  item: FeedbackItem;
  onUpdateColor: (color: string | null) => void;
  onClose: () => void;
}

export default function ItemSideDrawer({ item, onUpdateColor, onClose }: Props) {
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const defaultTint = DEFAULT_TINTS[item.type] || '#64748B';
  const isIconLayout = NODE_LAYOUTS[item.type] === 'icon';

  return (
    <aside className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-2xs font-semibold"
            style={{ backgroundColor: item.board_color || defaultTint }}
          >
            {typeLabel.charAt(0)}
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-ink truncate">{item.title}</span>
            <span className="block text-2xs text-muted">{typeLabel}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isIconLayout && (
          <div>
            <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Node Colour</h4>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateColor(null)}
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-transform ${
                  item.board_color == null ? 'border-ink scale-110' : 'border-edge'
                }`}
                style={{ backgroundColor: defaultTint }}
                title="Default"
              >
                {item.board_color == null && <Check size={10} className="text-white" />}
              </button>
              {FUNNEL_COLOR_PRESETS.map((hex) => {
                const active = item.board_color === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onUpdateColor(hex)}
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-transform hover:scale-110 ${
                      active ? 'border-ink scale-110' : 'border-edge'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                  >
                    {active && <Check size={10} className="text-white" />}
                  </button>
                );
              })}
              <input
                type="color"
                value={item.board_color || defaultTint}
                onChange={(e) => onUpdateColor(e.target.value)}
                className="w-7 h-7 rounded-lg border border-edge cursor-pointer"
                title="Custom colour"
              />
            </div>
          </div>
        )}

        {!isIconLayout && (
          <p className="text-xs text-muted">
            Colour customisation is available for icon-type nodes (Email, SMS, Ad).
          </p>
        )}
      </div>
    </aside>
  );
}
