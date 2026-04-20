// components/reviews/PendingHighlightPopover.tsx
'use client';

import { useEffect } from 'react';
import { Highlighter } from 'lucide-react';
import PendingPinForm from './comments/PendingPinForm';
import { usePopoverPosition } from '@/hooks/usePopoverPosition';
import type { ReviewCommentAttachment } from '@/lib/supabase';

interface PendingHighlightPopoverProps {
  /** Anchor position as percentages (computed from the selection rect) */
  pinX: number;
  pinY: number;
  /** Container element for positioning (must be position: relative) */
  containerRef: React.RefObject<HTMLDivElement>;
  /** The highlighted text — shown above the form for confirmation */
  highlightText: string;
  /** Submit the highlight comment */
  onSubmit: (content: string, attachments?: ReviewCommentAttachment[]) => Promise<void>;
  /** Cancel/dismiss handler — clears pending highlight */
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

export default function PendingHighlightPopover({
  pinX,
  pinY,
  highlightText,
  onSubmit,
  onCancel,
  companyId,
  authorName,
  guestName,
  onNameChange,
}: PendingHighlightPopoverProps) {
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
      <div className="fixed inset-0 z-40" onClick={onCancel} />

      <div
        style={style}
        className="w-[300px] z-50 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 rounded-lg bg-teal/5 border border-teal/20">
          <div className="flex items-center gap-1.5 mb-1">
            <Highlighter size={10} className="text-teal" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal">
              Highlighted text
            </p>
          </div>
          <p className="text-xs text-gray-700 italic line-clamp-3">&ldquo;{highlightText}&rdquo;</p>
        </div>

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
