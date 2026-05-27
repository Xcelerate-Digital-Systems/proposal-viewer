'use client';

import { useEffect } from 'react';
import PendingPinForm from './comments/PendingPinForm';
import { usePopoverPosition } from '@/hooks/usePopoverPosition';
import { POPOVER_STYLE, POPOVER_INLINE_STYLE } from '@/lib/feedback/popover-style';
import type { FeedbackCommentAttachment } from '@/lib/supabase';
import type { FeedbackCommentPriority } from '@/lib/types/feedback';
import type { FeedbackMode } from '@/components/feedback/tools';

interface PendingPinPopoverProps {
  /** Pin position as percentages (0–100) within the container */
  pinX: number;
  pinY: number;
  /** Container element for positioning context (must be position: relative) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Submit handler — receives content, attachments, priority, and an optional video URL */
  onSubmit: (content: string, attachments?: FeedbackCommentAttachment[], priority?: FeedbackCommentPriority, videoUrl?: string | null) => Promise<void>;
  /** Cancel/dismiss handler — clears pending pin */
  onCancel: () => void;
  /** Company ID for attachment uploads */
  companyId?: string;
  /** Share token — needed for the reviewer-side video upload path */
  shareToken?: string;

  /** Team: fixed author name */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: name change handler */
  onNameChange?: (name: string) => void;

  /** Optional quoted text shown above the composer (used when posting from highlight mode) */
  quotedText?: string;
  /** When present, surfaces a drawing menu inside the composer; activating a tool
   *  dismisses the popover (parent closes via onCancel) and enters that mode. */
  onOpenDrawing?: (mode: FeedbackMode) => void;
  /** API endpoint returning mentionable participants for the composer. */
  participantsUrl?: string | null;
}

export default function PendingPinPopover({
  pinX,
  pinY,
  onSubmit,
  onCancel,
  companyId,
  shareToken,
  authorName,
  guestName,
  onNameChange,
  quotedText,
  onOpenDrawing,
  participantsUrl,
}: PendingPinPopoverProps) {
  const style = usePopoverPosition(pinX, pinY);

  // Popover positions to the right of the pin when pinX < 60, otherwise to the
  // left. The tail points back at the pin from whichever side is adjacent.
  const tailOnLeft = pinX < 60;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <>
      {/* Backdrop — click outside to dismiss */}
      <div className="fixed inset-0 z-40" onClick={onCancel} />

      <div
        style={{ ...style, width: POPOVER_STYLE.widthPx, ...POPOVER_INLINE_STYLE }}
        className="relative bg-white rounded-2xl border border-gray-200 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tail — rotated square on the popover's adjacent edge */}
        <div
          aria-hidden
          className={`absolute top-6 w-3 h-3 bg-white rotate-45 ${
            tailOnLeft
              ? '-left-[7px] border-l border-b border-gray-200'
              : '-right-[7px] border-r border-t border-gray-200'
          }`}
        />

        <PendingPinForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          companyId={companyId}
          shareToken={shareToken}
          authorName={authorName}
          guestName={guestName}
          onNameChange={onNameChange}
          quotedText={quotedText}
          onOpenDrawing={onOpenDrawing}
          participantsUrl={participantsUrl}
        />
      </div>
    </>
  );
}
