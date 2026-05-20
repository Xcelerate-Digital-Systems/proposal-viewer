// components/viewer/ProposalDecisionPanel.tsx
// Shared Accept / Decline / Request-Changes panel used by the Quote page
// (rendered inline at the bottom) and by the proposal Decision page
// (rendered as its own synthetic final page). Caller supplies the resolved
// style tokens so the panel can be themed independently per surface without
// re-reading branding cascades internally.

'use client';

import { useState } from 'react';
import { Check, MessageSquare, X } from 'lucide-react';

export interface DecisionPanelTokens {
  bodyBg: string;
  bodyText: string;
  headingColor: string;
  /** withAlpha(bodyText, 0.6) — secondary text */
  muted: string;
  /** withAlpha(bodyText, 0.45) — label / placeholder colour */
  faint: string;
  /** withAlpha(bodyText, 0.1) — borders / hairlines */
  hairline: string;
  headingFontFamily: string;
  /** Title style (font family + weight + colour). Used for headings. */
  titleStyle: React.CSSProperties;
  /** Pre-computed muted text style ({ color: muted }). */
  mutedStyle: React.CSSProperties;
}

interface ProposalDecisionPanelProps {
  onAccept?: (name: string) => Promise<void>;
  onDecline?: (name: string, reason: string) => Promise<void>;
  onRequestRevision?: (name: string, notes: string) => Promise<void>;
  accepted?: boolean;
  declined?: boolean;
  revisionRequested?: boolean;
  tokens: DecisionPanelTokens;
  /** Label on the accept submit button. Defaults to "Accept & Confirm Quote". */
  acceptButtonText?: string;
}

type DecisionState = 'pending' | 'accepted' | 'declined' | 'revision';

/** Convert any CSS colour to rgba with explicit alpha. Mirrors the helper in
    QuoteSinglePageView — duplicated rather than imported to keep this panel
    free of cross-file coupling. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return color;
}

export default function ProposalDecisionPanel({
  onAccept,
  onDecline,
  onRequestRevision,
  accepted: initialAccepted,
  declined: initialDeclined,
  revisionRequested: initialRevisionRequested,
  tokens,
  acceptButtonText,
}: ProposalDecisionPanelProps) {
  const initialState: DecisionState = initialAccepted
    ? 'accepted'
    : initialDeclined
      ? 'declined'
      : initialRevisionRequested
        ? 'revision'
        : 'pending';

  const [state, setState] = useState<DecisionState>(initialState);
  const [activeAction, setActiveAction] = useState<'accept' | 'decline' | 'revision'>('accept');
  const [agree, setAgree] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { bodyBg, bodyText, headingColor, muted, faint, hairline, headingFontFamily, titleStyle, mutedStyle } = tokens;
  const showDecisionButtons = state === 'pending' && (onAccept || onDecline || onRequestRevision);

  const submit = async () => {
    if (submitting) return;
    if (!signerName.trim()) return;
    setSubmitting(true);
    try {
      if (activeAction === 'accept' && onAccept) {
        if (!agree) return;
        await onAccept(signerName.trim());
        setState('accepted');
      } else if (activeAction === 'decline' && onDecline) {
        await onDecline(signerName.trim(), reason.trim());
        setState('declined');
      } else if (activeAction === 'revision' && onRequestRevision) {
        if (!reason.trim()) return;
        await onRequestRevision(signerName.trim(), reason.trim());
        setState('revision');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!(onAccept || onDecline || onRequestRevision)) return null;

  return (
    <div className="max-w-md mx-auto text-center py-6 print:hidden">
      {state === 'accepted' && (
        <>
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-5"
            style={{ backgroundColor: headingColor, color: bodyBg }}
          >
            <Check size={16} />
          </div>
          <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
            Quote Accepted
          </h3>
          <p className="text-sm" style={mutedStyle}>
            Thanks {signerName || ''} — we&apos;ll be in touch shortly.
          </p>
        </>
      )}

      {state === 'declined' && (
        <>
          <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
            Quote Declined
          </h3>
          <p className="text-sm" style={mutedStyle}>
            Noted — thanks for letting us know{signerName ? `, ${signerName}` : ''}.
          </p>
        </>
      )}

      {state === 'revision' && (
        <>
          <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
            Revision Requested
          </h3>
          <p className="text-sm" style={mutedStyle}>
            We&apos;ve been notified and will get back to you shortly.
          </p>
        </>
      )}

      {state === 'pending' && (
        <>
          <h3 className="text-2xl sm:text-3xl tracking-tight mb-2" style={titleStyle}>
            {activeAction === 'accept'
              ? 'Ready to lock in your project?'
              : activeAction === 'decline'
                ? 'Decline this quote?'
                : 'Request changes to this quote?'}
          </h3>
          <p className="text-sm mb-6" style={mutedStyle}>
            {activeAction === 'accept'
              ? 'Sign below to confirm your project and secure your quoted price.'
              : activeAction === 'decline'
                ? "Let us know why if you'd like — it helps us improve."
                : "Tell us what you'd like changed and we'll send a revised quote."}
          </p>

          {showDecisionButtons && (
            <div
              className="inline-flex rounded-lg p-1 mb-5 text-xs"
              style={{ backgroundColor: withAlpha(bodyText, 0.05) }}
            >
              {onAccept && (
                <button
                  type="button"
                  onClick={() => setActiveAction('accept')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeAction === 'accept' ? 'shadow-sm' : ''}`}
                  style={
                    activeAction === 'accept'
                      ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                      : { color: muted }
                  }
                >
                  Accept
                </button>
              )}
              {onRequestRevision && (
                <button
                  type="button"
                  onClick={() => setActiveAction('revision')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeAction === 'revision' ? 'shadow-sm' : ''}`}
                  style={
                    activeAction === 'revision'
                      ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                      : { color: muted }
                  }
                >
                  Request Changes
                </button>
              )}
              {onDecline && (
                <button
                  type="button"
                  onClick={() => setActiveAction('decline')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeAction === 'decline' ? 'shadow-sm' : ''}`}
                  style={
                    activeAction === 'decline'
                      ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                      : { color: muted }
                  }
                >
                  Decline
                </button>
              )}
            </div>
          )}

          {activeAction === 'accept' && (
            <label
              className="flex items-start gap-3 mb-5 text-left text-[13px] px-4 py-3 rounded-lg"
              style={{
                border: `1px solid ${hairline}`,
                backgroundColor: bodyBg,
                color: bodyText,
              }}
            >
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5"
              />
              <span>I have read and agree to the proposal details and terms above.</span>
            </label>
          )}

          {activeAction !== 'accept' && (
            <div className="text-left mb-5">
              <label
                className="block text-[10px] tracking-[0.18em] uppercase mb-1.5"
                style={{ color: faint, fontFamily: headingFontFamily }}
              >
                {activeAction === 'revision' ? 'What changes do you need?' : 'Reason (optional)'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={
                  activeAction === 'revision'
                    ? 'e.g. Could you split the bathroom into two phases?'
                    : 'e.g. Going with another quote for now.'
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
                style={{
                  border: `1px solid ${hairline}`,
                  backgroundColor: bodyBg,
                  color: bodyText,
                }}
              />
            </div>
          )}

          <div className="text-left mb-6">
            <label
              className="block text-[10px] tracking-[0.18em] uppercase mb-1.5"
              style={{ color: faint, fontFamily: headingFontFamily }}
            >
              Type your full name to confirm
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
              style={{
                border: `1px solid ${hairline}`,
                backgroundColor: bodyBg,
                color: bodyText,
              }}
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              !signerName.trim() ||
              (activeAction === 'accept' && !agree) ||
              (activeAction === 'revision' && !reason.trim())
            }
            className="w-full px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{
              backgroundColor:
                activeAction === 'decline'
                  ? withAlpha('#dc2626', 0.85)
                  : headingColor,
              color: bodyBg,
            }}
          >
            {activeAction === 'accept' && <Check size={14} />}
            {activeAction === 'revision' && <MessageSquare size={14} />}
            {activeAction === 'decline' && <X size={14} />}
            {submitting
              ? 'Submitting…'
              : activeAction === 'accept'
                ? (acceptButtonText || 'Accept & Confirm Quote')
                : activeAction === 'revision'
                  ? 'Request Changes'
                  : 'Decline Quote'}
          </button>
        </>
      )}
    </div>
  );
}
