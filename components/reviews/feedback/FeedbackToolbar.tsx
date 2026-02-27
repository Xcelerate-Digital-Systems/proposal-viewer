// components/reviews/feedback/FeedbackToolbar.tsx
'use client';

import { MapPin, MessageSquare } from 'lucide-react';

export type FeedbackMode = 'idle' | 'pin';

interface FeedbackToolbarProps {
  /** Current active mode */
  mode: FeedbackMode;
  /** Callback when a tool is clicked */
  onModeChange: (mode: FeedbackMode) => void;
  /** Toggle comments panel */
  onToggleComments: () => void;
  /** Whether comments panel is open */
  commentsOpen: boolean;
  /** Number of unresolved comments */
  unresolvedCount: number;
  /** Hide pin tool (e.g. for webpage items) */
  hidePinTool?: boolean;
  /** Additional className for positioning */
  className?: string;
}

export default function FeedbackToolbar({
  mode,
  onModeChange,
  onToggleComments,
  commentsOpen,
  unresolvedCount,
  hidePinTool = false,
  className = '',
}: FeedbackToolbarProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 z-30 ${className}`}
    >
      {/* Pin tool */}
      {!hidePinTool && (
        <ToolButton
          active={mode === 'pin'}
          onClick={() => onModeChange(mode === 'pin' ? 'idle' : 'pin')}
          tooltip="Pin Comment"
          icon={<MapPin size={18} />}
        />
      )}

      {/* Separator */}
      {!hidePinTool && (
        <div className="w-6 h-px bg-gray-200 my-0.5" />
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
          ? 'bg-[#017C87] text-white shadow-sm'
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
              ? 'bg-white text-[#017C87]'
              : 'bg-[#017C87] text-white'
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