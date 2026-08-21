'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Check } from 'lucide-react';
import type { FunnelBoardSection } from '@/lib/supabase';
import { FUNNEL_SECTION_COLOR_KEYS, sectionPalette } from '@/lib/types/funnel';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Props {
  section: FunnelBoardSection;
  onUpdate: (patch: Partial<FunnelBoardSection>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function SectionSideDrawer({ section, onUpdate, onDelete, onClose }: Props) {
  const confirm = useConfirm();
  const [label, setLabel] = useState(section.label);
  useEffect(() => { setLabel(section.label); }, [section.id, section.label]);

  const commitLabel = () => {
    const next = label.trim() || 'Section';
    if (next !== section.label) onUpdate({ label: next });
  };

  const palette = sectionPalette(section.color);

  return (
    <motion.aside
      data-side-drawer
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg shrink-0 border-2"
            style={{ backgroundColor: palette.fill, borderColor: palette.border }}
          />
          <span className="text-xs font-semibold text-ink truncate">Section</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="block text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">
            Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
          />
          <p className="text-2xs text-muted/70 mt-0.5 leading-snug">
            Grows as you zoom out, so the board still reads as named phases.
          </p>
        </div>

        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Colour</h4>
          <div className="flex flex-wrap gap-1.5">
            {FUNNEL_SECTION_COLOR_KEYS.map((key) => {
              const p = sectionPalette(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUpdate({ color: key })}
                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-transform hover:scale-105 ${
                    section.color === key ? 'ring-2 ring-offset-1 ring-ink/30' : ''
                  }`}
                  style={{ backgroundColor: p.fill, borderColor: p.border }}
                  title={p.label}
                >
                  {section.color === key && <Check size={13} style={{ color: p.text }} />}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-2xs text-muted/70 leading-snug">
          Nodes belong to a section by sitting inside it — drag one in or out to
          change which section it&rsquo;s part of. Moving the section carries
          whatever is inside along with it.
        </p>
      </div>

      <div className="px-4 py-3 border-t border-edge">
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete "${section.label}"`,
              message: 'The section outline is removed. Nodes inside it stay exactly where they are.',
              confirmLabel: 'Delete section',
              destructive: true,
            });
            if (ok) onDelete();
          }}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-rose-500 rounded-lg py-1.5 transition-colors"
        >
          <Trash2 size={12} />
          Delete section
        </button>
      </div>
    </motion.aside>
  );
}
