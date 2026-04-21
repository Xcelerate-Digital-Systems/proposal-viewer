'use client';

import { useEffect } from 'react';
import PendingPinForm from './comments/PendingPinForm';
import { usePopoverPosition } from '@/hooks/usePopoverPosition';
import { POPOVER_STYLE, POPOVER_INLINE_STYLE } from '@/lib/feedback/popover-style';
import type { FeedbackCommentAttachment } from '@/lib/supabase';

interface PendingPinPopoverProps {
  /** Pin position as percentages (0–100) within the container */
  pinX: number;
  pinY: number;
  /** Container element for positioning context (must be position: relative) */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Submit handler — receives content and uploaded attachments */
  onSubmit: (content: string, attachments?: FeedbackCommentAttachment[]) => Promise<void>;
  /** Cancel/dismiss handler — clears pending pin */
  onCancel: () => void;
  /** Company ID for attachment uploads */
  companyId?: string;

  /** Team: fixed author name */
  authorName?: string;
  /** Guest: editable name */
  guestName?: string;
  /** Guest: name change handler */
  onNameChange?: (name: string) => void;
}

export default function PendingPinPopover({
  pinX,
  pinY,
  onSubmit,
  onCancel,
  companyId,
  authorName,
  guestName,
  onNameChange,
}: PendingPinPopoverProps) {
  const style = usePopoverPosition(pinX, pinY);

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
        className="bg-white rounded-xl border border-gray-200 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <PendingPinForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          companyId={companyId}
          authorName={authorName}
          guestName={guestName}
          onNameChange={onNameChange}
        />
      </div>
    </>
  );
}
