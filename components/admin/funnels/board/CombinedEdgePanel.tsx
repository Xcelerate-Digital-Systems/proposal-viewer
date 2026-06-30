'use client';

import { useState } from 'react';
import type { Edge } from '@xyflow/react';
import EdgeStyleEditor from '@/components/admin/feedback/board/EdgeStyleEditor';
import EdgeSplitEditor from './EdgeSplitEditor';
import type { FunnelBoardEdge } from '@/lib/supabase';

export default function CombinedEdgePanel({
  edge, onUpdateStyle, onDelete, onClose, splitContext, onUpdateSplit,
}: {
  edge: Edge;
  onUpdateStyle: (edgeId: string, patch: Record<string, unknown>) => void | Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  splitContext: { edge: FunnelBoardEdge; siblings: FunnelBoardEdge[]; flowThrough: number } | null;
  onUpdateSplit?: (patch: Partial<FunnelBoardEdge>) => void;
}) {
  const [tab, setTab] = useState<'style' | 'split'>('style');
  const hasSplit = !!splitContext;
  return (
    <div className="flex flex-col items-center">
      {hasSplit && (
        <div className="flex items-center gap-0.5 bg-white rounded-t-lg border border-b-0 border-edge px-1 pt-1">
          <button
            type="button"
            onClick={() => setTab('style')}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors ${
              tab === 'style' ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
            }`}
          >Style</button>
          <button
            type="button"
            onClick={() => setTab('split')}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors ${
              tab === 'split' ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
            }`}
          >Split</button>
        </div>
      )}
      {tab === 'style' ? (
        <EdgeStyleEditor edge={edge} onUpdate={onUpdateStyle} onDelete={onDelete} onClose={onClose} />
      ) : splitContext && onUpdateSplit ? (
        <EdgeSplitEditor
          edge={splitContext.edge}
          siblings={splitContext.siblings}
          flowThrough={splitContext.flowThrough}
          onUpdate={onUpdateSplit}
        />
      ) : null}
    </div>
  );
}
