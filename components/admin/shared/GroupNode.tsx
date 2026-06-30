'use client';

import { memo } from 'react';
import { type NodeProps, NodeResizer } from '@xyflow/react';

export interface GroupNodeData {
  label: string;
  color: string;
}

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  teal:   { bg: 'bg-teal/5',    border: 'border-teal/30',    text: 'text-teal' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-500' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-600' },
  rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-500' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500' },
};

const GROUP_COLORS = ['teal', 'blue', 'purple', 'amber', 'rose', 'gray'];
let colorIndex = 0;
export function nextGroupColor(): string {
  const c = GROUP_COLORS[colorIndex % GROUP_COLORS.length];
  colorIndex++;
  return c;
}

function GroupNode({ data, selected }: NodeProps) {
  const d = data as unknown as GroupNodeData;
  const palette = COLORS[d.color] || COLORS.teal;

  return (
    <div
      className={`w-full h-full rounded-xl border-2 border-dashed ${palette.bg} ${palette.border} ${
        selected ? 'ring-2 ring-teal/40' : ''
      }`}
      style={{ minWidth: 100, minHeight: 80 }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={100}
        minHeight={80}
        lineClassName="!border-teal/30"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-teal !rounded-sm"
      />
      <div className={`absolute -top-5 left-2 text-2xs font-semibold ${palette.text} select-none`}>
        {d.label}
      </div>
    </div>
  );
}

export default memo(GroupNode);
