'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import type { FunnelMessageKind, FunnelNodeMessage } from '@/lib/types/funnel';

interface Props {
  kind: FunnelMessageKind;
  message: FunnelNodeMessage | null;
  onChange: (next: FunnelNodeMessage | null) => void;
  /** Opens the same modal the canvas badge opens, so the agency can check the
   *  preview without leaving the drawer. Hidden until there's a body. */
  onPreview?: () => void;
  /** Resets local drafts when the drawer switches to a different node. */
  nodeId: string;
}

/** Roughly one SMS segment for GSM-7. Purely advisory — we don't block on it. */
const SMS_SEGMENT = 160;

/**
 * Sidebar editor for the email/SMS copy attached to a funnel node.
 *
 * Writes are debounced and accumulated into a single pending patch, then
 * flushed on unmount and on node switch — same approach as the metric fields
 * in StepSideDrawer, so tabbing between Subject and Body can't drop the
 * earlier field's write.
 */
export default function NodeMessageEditor({ kind, message, onChange, onPreview, nodeId }: Props) {
  const [from, setFrom] = useState(message?.from ?? '');
  const [subject, setSubject] = useState(message?.subject ?? '');
  const [preheader, setPreheader] = useState(message?.preheader ?? '');
  const [body, setBody] = useState(message?.body ?? '');

  // Re-seed the drafts only when the drawer moves to a different node, so an
  // in-flight debounce doesn't get clobbered by the row echoing back.
  useEffect(() => {
    setFrom(message?.from ?? '');
    setSubject(message?.subject ?? '');
    setPreheader(message?.preheader ?? '');
    setBody(message?.body ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<FunnelNodeMessage> | null>(null);
  const messageRef = useRef(message);
  messageRef.current = message;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const merged: FunnelNodeMessage = {
      kind,
      from: null, subject: null, preheader: null, body: '',
      ...(messageRef.current || {}),
      ...pending,
    };
    // An entirely empty message is stored as NULL so the node loses its badge
    // rather than carrying a hollow one.
    const isEmpty = !merged.body.trim() && !merged.subject?.trim()
      && !merged.preheader?.trim() && !merged.from?.trim();
    onChangeRef.current(isEmpty ? null : merged);
  }, [kind]);

  const queue = useCallback((patch: Partial<FunnelNodeMessage>) => {
    pendingRef.current = { ...(pendingRef.current || {}), ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 400);
  }, [flush]);

  useEffect(() => () => flush(), [nodeId, flush]);

  const clear = () => {
    pendingRef.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setFrom(''); setSubject(''); setPreheader(''); setBody('');
    onChange(null);
  };

  const hasContent = !!(body.trim() || subject.trim());
  const segments = Math.max(1, Math.ceil(body.length / SMS_SEGMENT));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted">
          {kind === 'email' ? 'Email content' : 'SMS content'}
        </h4>
        {hasContent && (
          <div className="flex items-center gap-1">
            {onPreview && (
              <button
                type="button"
                onClick={onPreview}
                className="flex items-center gap-1 text-2xs text-muted hover:text-teal px-1.5 py-0.5 rounded transition-colors"
                title="Preview"
              >
                <Eye size={11} /> Preview
              </button>
            )}
            <button
              type="button"
              onClick={clear}
              className="w-6 h-6 rounded text-muted hover:text-rose-600 flex items-center justify-center transition-colors"
              title="Remove message"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {kind === 'email' && (
          <>
            <input
              value={from}
              onChange={(e) => { setFrom(e.target.value); queue({ from: e.target.value || null }); }}
              placeholder="From (e.g. Jack at Black Lion)"
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
            />
            <input
              value={subject}
              onChange={(e) => { setSubject(e.target.value); queue({ subject: e.target.value || null }); }}
              placeholder="Subject line"
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
            />
            <input
              value={preheader}
              onChange={(e) => { setPreheader(e.target.value); queue({ preheader: e.target.value || null }); }}
              placeholder="Preheader (inbox preview text)"
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
            />
          </>
        )}

        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); queue({ body: e.target.value }); }}
          rows={kind === 'email' ? 8 : 5}
          placeholder={kind === 'email'
            ? 'Write the email, or paste an example of what it will say…'
            : 'Write the text message, or paste an example…'}
          className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal resize-y"
        />

        <p className="text-2xs text-muted/70 leading-snug">
          {kind === 'sms' && body.length > 0
            ? `${body.length} characters · ${segments} segment${segments === 1 ? '' : 's'}. `
            : ''}
          Anyone with the funnel&rsquo;s share link can read this.
        </p>
      </div>
    </div>
  );
}
