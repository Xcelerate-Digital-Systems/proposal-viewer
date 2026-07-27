'use client';

import { memo } from 'react';
import {
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { Plus } from 'lucide-react';

export interface SitemapEdgeData extends Record<string, unknown> {
  label?: string;
  sourceId?: string;
  targetId?: string;
  onAddPage?: (parentId: string) => void;
}

function SitemapEdgeComponent({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const edgeData = data as SitemapEdgeData | undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {edgeData?.label && (
            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-medium text-slate-500 shadow-sm">
              {edgeData.label}
            </span>
          )}
          {edgeData?.onAddPage && edgeData.sourceId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                edgeData.onAddPage!(edgeData.sourceId!);
              }}
              className="w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-400 flex items-center justify-center shadow-sm hover:border-teal hover:text-teal hover:bg-teal-50 transition-colors"
              title="Add page"
            >
              <Plus size={10} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const SitemapEdge = memo(SitemapEdgeComponent);
SitemapEdge.displayName = 'SitemapEdge';
export default SitemapEdge;
