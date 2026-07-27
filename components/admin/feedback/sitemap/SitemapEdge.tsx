'use client';

import { memo } from 'react';
import {
  BaseEdge, getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

export interface SitemapEdgeData extends Record<string, unknown> {
  sourceId?: string;
  targetId?: string;
}

function SitemapEdgeComponent({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  return <BaseEdge id={id} path={edgePath} style={style} />;
}

const SitemapEdge = memo(SitemapEdgeComponent);
SitemapEdge.displayName = 'SitemapEdge';
export default SitemapEdge;
