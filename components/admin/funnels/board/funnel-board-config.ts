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
    const step = (n.data as { step?: { step_type?: string } } | undefined)?.step;
    const isPage = !!step?.step_type?.startsWith('page_');
    return {
      cx: n.position.x + 100,
      cy: n.position.y + (isPage ? 100 : 44),
    };
  }
  return genericVisualCentre(n);
}
