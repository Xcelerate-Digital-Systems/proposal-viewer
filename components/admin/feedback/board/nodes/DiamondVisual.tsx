'use client';

import type { LucideIcon } from 'lucide-react';
import { DIAMOND_BOX_SIZE, DIAMOND_INSET, DIAMOND_SIDE } from './diamond-config';

export function DiamondVisual({
  color, Icon, selected,
}: { color: string; Icon: LucideIcon; selected: boolean }) {
  return (
    <div className="relative" style={{ width: DIAMOND_BOX_SIZE, height: DIAMOND_BOX_SIZE }}>
      <div
        className="absolute rounded-lg shadow-[0_3px_8px_rgba(20,20,40,0.12)]"
        style={{
          top: DIAMOND_INSET,
          left: DIAMOND_INSET,
          width: DIAMOND_SIDE,
          height: DIAMOND_SIDE,
          transform: 'rotate(45deg)',
          background: color,
          outline: selected ? '2px solid #017C87' : 'none',
          outlineOffset: selected ? 2 : 0,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
        <Icon size={16} strokeWidth={2} />
      </div>
    </div>
  );
}
