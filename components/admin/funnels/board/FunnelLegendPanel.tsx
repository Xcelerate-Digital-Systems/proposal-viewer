'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Panel } from '@xyflow/react';
import { supabase } from '@/lib/supabase';

export interface LegendEntry {
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
  animated: boolean;
  label: string;
}

export interface FunnelLegend {
  id: string;
  funnel_id: string;
  company_id: string;
  tab_id: string | null;
  position: string;
  entries: LegendEntry[];
}

type PanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function positionToPanel(pos: string): PanelPosition {
  if (pos === 'top-left' || pos === 'top-right' || pos === 'bottom-left' || pos === 'bottom-right') return pos;
  return 'bottom-left';
}

function LegendLine({ entry }: { entry: LegendEntry }) {
  return (
    <svg width="32" height="12" viewBox="0 0 32 12" className="shrink-0">
      <line
        x1="0" y1="6" x2="32" y2="6"
        stroke={entry.stroke}
        strokeWidth={Math.min(entry.strokeWidth, 4)}
        strokeDasharray={entry.dashed ? '4 3' : undefined}
        strokeLinecap="round"
      />
      {entry.animated && (
        <circle r="2" fill={entry.stroke}>
          <animateMotion dur="1s" repeatCount="indefinite" path="M0,6 L32,6" />
        </circle>
      )}
    </svg>
  );
}

export function FunnelLegendPanelReadOnly({
  legend,
}: {
  legend: FunnelLegend;
}) {
  if (!legend.entries.length) return null;
  return (
    <Panel position={positionToPanel(legend.position)}>
      <div className="bg-white/95 backdrop-blur-sm border border-edge rounded-lg shadow-sm px-3 py-2 min-w-[140px] max-w-[260px]">
        <p className="text-2xs font-semibold text-ink/60 uppercase tracking-wider mb-1.5">Legend</p>
        <div className="flex flex-col gap-1.5">
          {legend.entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <LegendLine entry={entry} />
              <span className="text-xs text-ink/80 leading-tight">{entry.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export default function FunnelLegendPanel({
  funnelId,
  tabId,
}: {
  funnelId: string;
  tabId: string | null;
}) {
  const [legend, setLegend] = useState<FunnelLegend | null>(null);

  const fetchLegend = useCallback(async () => {
    let q = supabase
      .from('funnel_legends')
      .select('*')
      .eq('funnel_id', funnelId);
    if (tabId) q = q.eq('tab_id', tabId);
    else q = q.is('tab_id', null);
    const { data } = await q.maybeSingle();
    setLegend(data as FunnelLegend | null);
  }, [funnelId, tabId]);

  useEffect(() => { fetchLegend(); }, [fetchLegend]);

  if (!legend || !legend.entries.length) return null;

  return <FunnelLegendPanelReadOnly legend={legend} />;
}
