'use client';

import { memo } from 'react';
import type { FunnelRole } from '@/lib/supabase';

/**
 * Owner marker on a node.
 *
 * Sits at the top-left so it never collides with the linked-funnel/tab badge,
 * which owns the top-right corner. `pointer-events-none` so it can't swallow
 * the click that opens the node's drawer.
 */
function RoleChip({ role, compact }: { role: FunnelRole; compact?: boolean }) {
  const initials = role.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  if (compact) {
    return (
      <div
        className="absolute -top-1 -left-1 w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow-sm pointer-events-none z-10 border-2 border-white"
        style={{ backgroundColor: role.color }}
        title={role.name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className="absolute -top-2 -left-2 max-w-[120px] px-1.5 py-0.5 rounded-full text-white text-[9px] font-semibold shadow-sm pointer-events-none z-10 border-2 border-white truncate"
      style={{ backgroundColor: role.color }}
      title={role.name}
    >
      {role.name}
    </div>
  );
}

export default memo(RoleChip);
