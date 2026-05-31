// components/viewer/ProposalDecisionPanel.tsx
// Shared Accept / Decline / Request-Changes panel used by the Quote page
// (rendered inline at the bottom) and by the proposal Decision page
// (rendered as its own synthetic final page). Caller supplies the resolved
// style tokens so the panel can be themed independently per surface without
// re-reading branding cascades internally.

'use client';

import { useState, useCallback, lazy, Suspense } from 'react';

const SignatureCapture = lazy(() => import('./SignatureCapture'));
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
  /** Body font family applied to the panel root so subtitle, toggle buttons,
   *  agreement copy, terminal-state body, and form inputs all pick up the
   *  Globals body font. NULL falls back to inherit. */
  bodyFontFamily?: string;
  /** Body font weight to match — propagates to inputs / toggle text. */
  bodyFontWeight?: string | number;
  /** Title style (font family + weight + colour). Used for headings. */
  titleStyle: React.CSSProperties;
  /** Pre-computed muted text style ({ color: muted }). */
  mutedStyle: React.CSSProperties;
}

interface SignatureData {
  mode: 'typed' | 'drawn';
  typed_name?: string;
  signature_image_base64?: string;
}

interface ProposalDecisionPanelProps {
  onAccept?: (name: string, signatureData?: SignatureData | null) => Promise<void>;
  requireSignature?: boolean;
  onDecline?: (name: string, reason: string) => Promise<void>;
  onRequestRevision?: (name: string, notes: string) => Promise<void>;
  accepted?: boolean;
  declined?: boolean;
  revisionRequested?: boolean;
  tokens: DecisionPanelTokens;
  /** Label on the accept submit button. Defaults to "Accept & Confirm Quote". */
  acceptButtonText?: string;
  /** Customisable Accept-tab copy. Each falls back to a sensible default. */
  acceptHeading?: string;
  acceptSubtitle?: string;
  agreementText?: string;
  /** Submit button labels — one per tab. acceptButtonText is the legacy
   *  per-proposal column kept for backwards compatibility; the new
   *  acceptButtonLabel from DecisionExtras takes precedence when provided. */
  acceptButtonLabel?: string;
  declineButtonLabel?: string;
  revisionButtonLabel?: string;
  /** Customisable Decline/Revision-tab copy. Each falls back to a sensible default. */
  declineHeading?: string;
  declineSubtitle?: string;
  revisionHeading?: string;
  revisionSubtitle?: string;
  /** Per-button background colour overrides. */
  acceptButtonColor?: string | null;
  declineButtonColor?: string | null;
  revisionButtonColor?: string | null;
  /** Checkbox accent colour. Null = browser default. */
  checkboxColor?: string | null;
  /** CTA button font + weight (mirrors the cover button cascade so the
   *  Accept/Decline/Request Changes submit button uses the same typeface as
   *  the cover CTA, with sensible fallbacks). */
  buttonFontFamily?: string | null;
  buttonFontWeight?: string | null;
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
  requireSignature,
  acceptHeading,
  acceptSubtitle,
  agreementText,
  acceptButtonLabel,
  declineButtonLabel,
  revisionButtonLabel,
  declineHeading,
  declineSubtitle,
  revisionHeading,
  revisionSubtitle,
  acceptButtonColor,
  declineButtonColor,
  revisionButtonColor,
  checkboxColor,
  buttonFontFamily,
  buttonFontWeight,
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
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const handleSignatureChange = useCallback((data: SignatureData | null) => setSignatureData(data), []);

  const { bodyBg, bodyText, headingColor, muted, faint, hairline, headingFontFamily, titleStyle, mutedStyle, bodyFontFamily, bodyFontWeight } = tokens;
  const showDecisionButtons = state === 'pending' && (onAccept || onDecline || onRequestRevision);

  const submit = async () => {
    if (submitting) return;
    if (!signerName.trim()) return;
    setSubmitting(true);
    try {
      if (activeAction === 'accept' && onAccept) {
        if (!agree) return;
        if (requireSignature && !signatureData) return;
        await onAccept(signerName.trim(), requireSignature ? signatureData : undefined);
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
    <div
      className="max-w-md mx-auto text-center py-6 print:hidden"
      style={{
        // Set body font on the root so subtitle / toggle text / agreement /
        // terminal copy / textarea / name input all inherit the Globals
        // "Body font" + weight. Title + heading + button overrides still
        // win inline.
        fontFamily: bodyFontFamily,
        fontWeight: bodyFontWeight,
      }}
    >
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
              ? (acceptHeading || 'Ready to lock in your project?')
              : activeAction === 'decline'
                ? (declineHeading || 'Decline this quote?')
                : (revisionHeading || 'Request changes to this quote?')}
          </h3>
          <p className="text-sm mb-6" style={mutedStyle}>
            {activeAction === 'accept'
              ? (acceptSubtitle || 'Sign below to confirm your project and secure your quoted price.')
              : activeAction === 'decline'
                ? (declineSubtitle || "Let us know why if you'd like — it helps us improve.")
                : (revisionSubtitle || "Tell us what you'd like changed and we'll send a revised quote.")}
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
                  className={`px-3 py-1.5 rounded-lg transition-colors ${activeAction === 'accept' ? 'shadow-sm' : ''}`}
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
                  className={`px-3 py-1.5 rounded-lg transition-colors ${activeAction === 'revision' ? 'shadow-sm' : ''}`}
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
                  className={`px-3 py-1.5 rounded-lg transition-colors ${activeAction === 'decline' ? 'shadow-sm' : ''}`}
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
              className="flex items-start gap-3 mb-5 text-left text-caption px-4 py-3 rounded-lg"
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
                style={checkboxColor ? { accentColor: checkboxColor } : undefined}
              />
              <span>{agreementText || 'I have read and agree to the proposal details and terms above.'}</span>
            </label>
          )}

          {activeAction !== 'accept' && (
            <div className="text-left mb-5">
              <label
                className="block text-2xs tracking-[0.18em] uppercase mb-1.5"
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
                className="w-full px-3 py-2.5 rounded-lg text-base md:text-sm focus:outline-none transition-colors"
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
              className="block text-2xs tracking-[0.18em] uppercase mb-1.5"
              style={{ color: faint, fontFamily: headingFontFamily }}
            >
              Type your full name to confirm
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2.5 rounded-lg text-base md:text-sm focus:outline-none transition-colors"
              style={{
                border: `1px solid ${hairline}`,
                backgroundColor: bodyBg,
                color: bodyText,
              }}
            />
          </div>

          {requireSignature && activeAction === 'accept' && (
            <div className="mb-6">
              <label
                className="block text-2xs tracking-[0.18em] uppercase mb-2"
                style={{ color: faint, fontFamily: headingFontFamily }}
              >
                Your Signature
              </label>
              <Suspense fallback={<div className="h-28 rounded-xl border-2 border-dashed border-gray-200 animate-pulse" />}>
                <SignatureCapture
                  signerName={signerName}
                  accentColor={headingColor}
                  onSignatureChange={handleSignatureChange}
                />
              </Suspense>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              !signerName.trim() ||
              (activeAction === 'accept' && !agree) ||
              (activeAction === 'accept' && requireSignature && !signatureData) ||
              (activeAction === 'revision' && !reason.trim())
            }
            className="w-full px-6 py-3 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 tracking-wider uppercase"
            style={{
              backgroundColor:
                activeAction === 'accept'
                  ? (acceptButtonColor || headingColor)
                  : activeAction === 'decline'
                    ? (declineButtonColor || withAlpha('#dc2626', 0.85))
                    : (revisionButtonColor || headingColor),
              color: bodyBg,
              // Mirror the Cover CTA button styling — Globals "Button font"
              // controls both. Fall back to the heading font if no override.
              fontFamily: buttonFontFamily
                ? `'${buttonFontFamily}', inherit`
                : headingFontFamily,
              fontWeight: Number(buttonFontWeight) || 500,
            }}
          >
            {activeAction === 'accept' && <Check size={14} />}
            {activeAction === 'revision' && <MessageSquare size={14} />}
            {activeAction === 'decline' && <X size={14} />}
            {submitting
              ? 'Submitting…'
              : activeAction === 'accept'
                ? (acceptButtonLabel || acceptButtonText || 'Accept & Confirm Quote')
                : activeAction === 'revision'
                  ? (revisionButtonLabel || 'Request Changes')
                  : (declineButtonLabel || 'Decline Quote')}
          </button>
        </>
      )}
    </div>
  );
}
