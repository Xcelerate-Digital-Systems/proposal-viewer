// components/admin/reviews/board/nodes/SMSNode.tsx
'use client';

import { Smartphone } from 'lucide-react';
import {
  type NodeItemProps,
  NodeHandles, StatusDot, CommentBadge, ViewButton,
} from './nodeConfig';

export default function SMSNode({
  item, selected, readOnly, commentCount, unresolvedCount, onNavigate,
}: NodeItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.(item.id);
  };

  return (
    <>
      <NodeHandles readOnly={readOnly} />

      <div
        className={`flex flex-col items-center w-[130px] ${!readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        onClick={readOnly ? handleClick : undefined}
      >
        <div className="relative">
          <div
            className={`
              w-[72px] h-[72px] rounded-full flex items-center justify-center
              border-2 transition-all shadow-sm bg-green-50 text-green-600
              ${selected ? 'border-[#017C87] shadow-lg ring-2 ring-[#017C87]/20' : 'border-green-200 hover:shadow-md'}
            `}
          >
            <Smartphone size={28} strokeWidth={1.5} />
          </div>
          <StatusDot status={item.status} />
          <CommentBadge count={commentCount} unresolved={unresolvedCount} />
        </div>

        <div className="mt-2 text-center max-w-full px-1">
          <h4 className="text-[11px] font-semibold text-gray-800 truncate leading-tight">{item.title}</h4>
          <span className="text-[9px] font-medium text-green-600 mt-0.5 block">SMS</span>
        </div>

        <div className="mt-1.5"><ViewButton id={item.id} onNavigate={onNavigate} /></div>
      </div>
    </>
  );
}