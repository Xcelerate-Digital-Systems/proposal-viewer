'use client';

import { useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { isRichComment } from '@/lib/feedback/mention-html';

// DOMPurify config — tight allowlist matching what MentionEditor can emit:
// paragraphs, hard breaks, and mention spans with their data-* attributes.
// The class on mention spans is preserved so the pill styling carries
// through; everything else (scripts, styles, urls, on* handlers) is dropped.
const SANITIZER_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'span'],
  ALLOWED_ATTR: ['data-type', 'data-id', 'data-label', 'class'],
  // Forbid anything that could smuggle script execution even with the
  // allowlist above (defense in depth — DOMPurify already blocks these).
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  KEEP_CONTENT: true,
};

interface Props {
  /** Raw comment.content from the database. Plain text for legacy comments;
   *  TipTap HTML (paragraphs, hard breaks, mention spans) for new ones. */
  content: string;
  className?: string;
}

/**
 * Renders comment content with mention pills styled. Legacy plain-text
 * comments render through whitespace-pre-wrap; rich comments are passed to
 * dangerouslySetInnerHTML after a tight allowlist sanitizer strips
 * everything except <p>, <br>, and our mention spans.
 */
export default function CommentContent({ content, className }: Props) {
  const html = useMemo(
    () => (isRichComment(content) ? (DOMPurify.sanitize(content, SANITIZER_CONFIG) as unknown as string) : null),
    [content]
  );

  if (html !== null) {
    return (
      <div
        className={(className ?? '') + ' tiptap-comment-display'}
        // Sanitised against the allowlist below — only paragraphs, hard
        // breaks, and our own mention spans survive.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <p className={`whitespace-pre-wrap ${className ?? ''}`}>{content}</p>;
}
