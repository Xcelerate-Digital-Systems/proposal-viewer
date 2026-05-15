'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FunnelStepType } from '@/lib/supabase';
import { FUNNEL_STEP_DEFAULTS, FUNNEL_STEP_TYPE_ORDER } from '@/lib/types/funnel';

interface Props {
  onPick: (stepType: FunnelStepType) => void;
}

export default function NodePalette({ onPick }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    traffic: true, page: true, offer: true, generic: false,
  });

  return (
    <aside className="w-[220px] shrink-0 border-r border-edge bg-white overflow-y-auto">
      <div className="px-4 py-3 border-b border-edge">
        <h3 className="text-[13px] font-semibold text-ink">Funnel steps</h3>
        <p className="text-[11px] text-muted mt-0.5">Click to add to canvas</p>
      </div>

      <div className="p-3 space-y-3">
        {FUNNEL_STEP_TYPE_ORDER.map((group) => {
          const isOpen = open[group.category];
          return (
            <div key={group.category}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [group.category]: !p[group.category] }))}
                className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted hover:text-ink transition-colors mb-1.5"
              >
                <span>{group.label}</span>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {isOpen && (
                <div className="grid grid-cols-2 gap-1.5">
                  {group.types.map((t) => {
                    const def = FUNNEL_STEP_DEFAULTS[t];
                    const isPage = t.startsWith('page_');
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onPick(t)}
                        className="group flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all"
                        title={`Add ${def.label}`}
                      >
                        {isPage ? (
                          // Tiny page mockup preview so the tile hints at the
                          // actual node visual ("looks like a page").
                          <span className="w-9 h-7 rounded-sm bg-white border border-edge shrink-0 overflow-hidden flex flex-col">
                            <span className="h-1.5 bg-surface border-b border-edge/60" />
                            <span className="flex-1 flex items-center justify-center" style={{ backgroundColor: `${def.tint}15` }}>
                              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: def.tint }} />
                            </span>
                          </span>
                        ) : (
                          <span
                            className="w-7 h-7 rounded-full shrink-0"
                            style={{ backgroundColor: def.tint }}
                          />
                        )}
                        <span className="text-[10px] text-ink/80 text-center leading-tight line-clamp-2">
                          {def.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
