// components/admin/reviews/board/nodes/GoogleAdNode.tsx
'use client';

import {
  type NodeItemProps,
  NodeHandles, StatusDot, CommentBadge, ViewButton,
} from './nodeConfig';

/* ─── Inline Google "G" logo ─────────────────────────────────────── */

function GoogleLogo({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-label="Google"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ─── Node component ───────────────────────────────────────────── */

export default function GoogleAdNode({
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
              border-2 transition-all shadow-sm bg-white
              ${selected ? 'border-teal shadow-lg ring-2 ring-teal/20' : 'border-[#4285F4]/30 hover:shadow-md'}
            `}
          >
            <GoogleLogo size={30} />
          </div>
          <StatusDot status={item.status} />
          <CommentBadge count={commentCount} unresolved={unresolvedCount} />
        </div>

        <div className="mt-2 text-center max-w-full px-1">
          <h4 className="text-[11px] font-semibold text-gray-800 truncate leading-tight">{item.title}</h4>
          <span className="text-[9px] font-medium text-[#4285F4] mt-0.5 block">Google Ad</span>
        </div>

        <div className="mt-1.5"><ViewButton id={item.id} onNavigate={onNavigate} /></div>
      </div>
    </>
  );
}
