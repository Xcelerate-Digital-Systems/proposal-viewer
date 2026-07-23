import type { Node } from '@xyflow/react';
import { genericVisualCentre } from '@/components/admin/shared/board-utils';

export { ALIGNMENT_TOLERANCE } from '@/components/admin/shared/board-utils';

export const defaultEdgeOptions = {
  type: 'labeled',
  animated: false,
  style: { stroke: '#2B2B2B', strokeWidth: 1.8 },
};

export function visualCentre(n: Node): { cx: number; cy: number } {
  if (n.type === 'funnelStep') {
    const m = (n as unknown as { measured?: { width?: number; height?: number } }).measured;
    const step = (n.data as { step?: { step_type?: string } } | undefined)?.step;
    const isPage = !!step?.step_type?.startsWith('page_');
    const w = m?.width ?? (isPage ? 200 : 88);
    const h = m?.height ?? (isPage ? 200 : 88);
    return {
      cx: n.position.x + w / 2,
      cy: n.position.y + h / 2,
    };
  }
  return genericVisualCentre(n);
}
