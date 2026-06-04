'use client';

import { useEffect, useState } from 'react';
import { Split } from 'lucide-react';
import type { FunnelBoardEdge } from '@/lib/supabase';
interface Props {
  edge: FunnelBoardEdge;
  /** Other outgoing edges from the same source step (excluding this one). */
  siblings: FunnelBoardEdge[];
  flowThrough: number;
  onUpdate: (patch: Partial<FunnelBoardEdge>) => void;
}

/**
 * Compact split-% editor that sits next to the standard EdgeStyleEditor when
 * a step → step edge is selected and its source has multiple outgoing edges.
 * Funnelytics-style: assign a percentage of upstream flow to this branch.
 */
export default function EdgeSplitEditor({ edge, siblings, flowThrough, onUpdate }: Props) {
  const [local, setLocal] = useState(edge.split_percent ?? '');
  useEffect(() => { setLocal(edge.split_percent ?? ''); }, [edge.id, edge.split_percent]);

  const commit = () => {
    const raw = String(local).trim();
    const next = raw === '' ? null : Math.max(0, Math.min(100, Number(raw) || 0));
    if (next !== edge.split_percent) onUpdate({ split_percent: next });
  };

  const siblingsSum = siblings.reduce((s, e) => s + (e.split_percent ?? 0), 0);
  const remaining = Math.max(0, 100 - siblingsSum - (edge.split_percent ?? 0));

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg border border-edge shadow-lg px-3 py-2">
      <Split size={14} className="text-muted shrink-0" />
      <label className="text-detail text-muted whitespace-nowrap">Split %</label>
      <div className="flex items-center bg-surface border border-edge rounded-lg focus-within:border-teal transition-colors">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="any"
          value={local}
          placeholder="auto"
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-16 px-2 py-1 text-xs bg-transparent outline-none"
        />
        <span className="text-detail text-muted pr-2">%</span>
      </div>
      {siblings.length > 0 && remaining > 0 && (
        <span className="text-2xs text-muted">{remaining.toFixed(0)}% remaining</span>
      )}
    </div>
  );
}
