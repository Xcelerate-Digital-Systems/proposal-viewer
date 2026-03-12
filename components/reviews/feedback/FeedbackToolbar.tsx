// components/reviews/feedback/FeedbackToolbar.tsx
'use client';

import { MessageSquare, MoveUpRight, Square, Type } from 'lucide-react';

/** Pin is always active by default. Drawing tools override pin mode when selected. */
export type FeedbackMode = 'idle' | 'pin' | 'arrow' | 'box' | 'text' | 'screenshot';

interface FeedbackToolbarProps {
  /** Toggle comments panel */
  onToggleComments: () => void;
  /** Whether comments panel is open */
  commentsOpen: boolean;
  /** Number of unresolved comments */
  unresolvedCount: number;

  /** Current feedback mode */
  mode?: FeedbackMode;
  /** Change feedback mode (for drawing tools) */
  onModeChange?: (mode: FeedbackMode) => void;

  /** Additional className for positioning */
  className?: string;
}

export default function FeedbackToolbar({
  onToggleComments,
  commentsOpen,
  unresolvedCount,
  mode = 'idle',
  onModeChange,
  className = '',
}: FeedbackToolbarProps) {
  const handleToolClick = (tool: FeedbackMode) => {
    if (!onModeChange) return;
    onModeChange(mode === tool ? 'idle' : tool);
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 z-30 ${className}`}
    >
      {/* Drawing tools */}
      {onModeChange && (
        <>
          <ToolButton
            active={mode === 'arrow'}
            onClick={() => handleToolClick('arrow')}
            tooltip="Arrow"
            icon={<MoveUpRight size={18} />}
          />
          <ToolButton
            active={mode === 'box'}
            onClick={() => handleToolClick('box')}
            tooltip="Rectangle"
            icon={<Square size={18} />}
          />
          <ToolButton
            active={mode === 'text'}
            onClick={() => handleToolClick('text')}
            tooltip="Text"
            icon={<Type size={18} />}
          />

          <div className="w-5 h-px bg-gray-200 my-0.5" />
        </>
      )}

      {/* Comments */}
      <ToolButton
        active={commentsOpen}
        onClick={onToggleComments}
        tooltip="Comments"
        icon={<MessageSquare size={18} />}
        badge={unresolvedCount > 0 ? unresolvedCount : undefined}
      />
    </div>
  );
}

/* ── Individual tool button ── */

function ToolButton({
  active,
  onClick,
  tooltip,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors group ${
        active
          ? 'bg-teal text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
      title={tooltip}
    >
      {icon}

      {/* Badge */}
      {badge != null && (
        <span
          className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1 ${
            active
              ? 'bg-white text-teal'
              : 'bg-teal text-white'
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}

      {/* Tooltip */}
      <span className="absolute right-full mr-2 px-2 py-1 rounded-md bg-gray-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg">
        {tooltip}
      </span>
    </button>
  );
}
