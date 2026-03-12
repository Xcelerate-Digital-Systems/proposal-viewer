// components/admin/reviews/board/nodes/FacebookNode.tsx
'use client';

import {
  type NodeItemProps,
  NodeHandles, StatusDot, CommentBadge, ViewButton,
} from './nodeConfig';

/* ─── Inline Facebook "f" logo ─────────────────────────────────── */

function FacebookLogo({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-label="Facebook"
    >
      <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L13.652 23.2H9.486V18h4.166v-3.51c0-5.269 3.233-7.944 7.71-7.944 2.106 0 3.88.158 4.397.228v5.26H23.11c-2.37 0-2.929 1.453-2.929 3.09V18h5.6l-.727 5.2h-4.873L20.181 35.87z" />
    </svg>
  );
}

/* ─── Node component ───────────────────────────────────────────── */

export default function FacebookNode({
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
              border-2 transition-all shadow-sm bg-white text-[#1877F2]
              ${selected ? 'border-teal shadow-lg ring-2 ring-teal/20' : 'border-[#1877F2]/30 hover:shadow-md'}
            `}
          >
            <FacebookLogo size={30} />
          </div>
          <StatusDot status={item.status} />
          <CommentBadge count={commentCount} unresolved={unresolvedCount} />
        </div>

        <div className="mt-2 text-center max-w-full px-1">
          <h4 className="text-[11px] font-semibold text-gray-800 truncate leading-tight">{item.title}</h4>
          <span className="text-[9px] font-medium text-[#1877F2] mt-0.5 block">Meta Ad</span>
        </div>

        <div className="mt-1.5"><ViewButton id={item.id} onNavigate={onNavigate} /></div>
      </div>
    </>
  );
}