'use client';

import { ExternalLink, FileText } from 'lucide-react';
import type { FeedbackCommentAttachment } from '@/lib/supabase';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface AttachmentListProps {
  attachments?: FeedbackCommentAttachment[];
  /** sm = compact (popovers, replies). md = default (sidebar threads). */
  size?: 'sm' | 'md';
}

export default function AttachmentList({ attachments, size = 'md' }: AttachmentListProps) {
  if (!attachments || attachments.length === 0) return null;

  const imgBox = size === 'sm' ? 'w-14 h-14' : 'w-16 h-16';
  const fileNameMax = size === 'sm' ? 'max-w-[80px]' : 'max-w-[100px]';

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((a, i) => {
        const isImage = IMAGE_TYPES.includes(a.type);
        return isImage ? (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block ${imgBox} rounded-lg border border-edge-strong overflow-hidden hover:border-teal/40 transition-colors`}
          >
            <img src={a.url} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
          </a>
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-edge-strong hover:border-teal/40 transition-colors"
          >
            <FileText size={10} className="text-faint shrink-0" />
            <span className={`text-2xs text-prose truncate ${fileNameMax}`}>{a.name}</span>
            <ExternalLink size={8} className="text-faint shrink-0" />
          </a>
        );
      })}
    </div>
  );
}
