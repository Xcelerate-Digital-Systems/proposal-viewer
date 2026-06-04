// components/viewer/ProposalDecisionPanel.tsx
// Shared Accept / Decline / Request-Changes panel used by the Quote page
// (rendered inline at the bottom) and by the proposal Decision page
// (rendered as its own synthetic final page). Caller supplies the resolved
// style tokens so the panel can be themed independently per surface without
// re-reading branding cascades internally.

'use client';

import { useState, useCallback, lazy, Suspense } from 'react';

const SignatureCapture = lazy(() => import('./SignatureCapture'));
import { Check, MessageSquare, X, AlertTriangle, Mail, Phone } from 'lucide-react';
import { withAlpha } from '@/lib/branding/with-alpha';

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
  /** Amount recap shown above the submit button on the accept tab. */
  proposalTitle?: string;
  totalAmount?: string;
  /** When true, disables the Accept action with an expiry message. */
  isExpired?: boolean;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
}

type DecisionState = 'pending' | 'accepted' | 'declined' | 'revision';

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
  proposalTitle,
  totalAmount,
  isExpired,
  companyName,
  companyEmail,
  companyPhone,
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const { bodyBg, bodyText, headingColor, muted, faint, hairline, headingFontFamily, titleStyle, mutedStyle, bodyFontFamily, bodyFontWeight } = tokens;
  const showDecisionButtons = state === 'pending' && (onAccept || onDecline || onRequestRevision);

  const submit = async () => {
    if (submitting) return;
    if (!signerName.trim()) return;
    setSubmitError(null);

    if (activeAction === 'accept' && !confirmStep && totalAmount) {
      setConfirmStep(true);
      return;
    }

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
      setConfirmStep(false);
    } catch {
      setSubmitError('Something went wrong. Please try again.');
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
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
            style={{ backgroundColor: headingColor, color: bodyBg }}
          >
            <Check size={20} strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
            Quote Accepted
          </h3>
          <p className="text-sm mb-6" style={mutedStyle}>
            Thanks{signerName ? `, ${signerName}` : ''}.{' '}
            {companyName ? `${companyName} has` : 'We’ve'} been notified and will be in touch to get things started.
          </p>
          {(proposalTitle || totalAmount) && (
            <div
              className="rounded-lg px-5 py-4 mb-6 text-left"
              style={{
                backgroundColor: withAlpha(bodyText, 0.03),
                border: `1px solid ${hairline}`,
              }}
            >
              {proposalTitle && (
                <div className="text-xs mb-1" style={{ color: faint }}>{proposalTitle}</div>
              )}
              {totalAmount && (
                <div className="text-lg font-semibold tabular-nums" style={{ color: headingColor }}>
                  {totalAmount}
                </div>
              )}
              {signerName && (
                <div className="text-xs mt-2" style={{ color: muted }}>
                  Accepted by {signerName}
                </div>
              )}
            </div>
          )}
          <div className="text-left space-y-2.5 text-sm mb-2" style={{ color: bodyText }}>
            <p className="text-2xs tracking-[0.18em] uppercase mb-3" style={{ color: faint, fontFamily: headingFontFamily }}>
              What happens next
            </p>
            <div className="flex items-start gap-3">
              <span className="shrink-0 tabular-nums text-xs font-medium mt-0.5" style={{ color: muted }}>1</span>
              <span>{companyName || 'The team'} will review your acceptance and reach out to confirm next steps.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 tabular-nums text-xs font-medium mt-0.5" style={{ color: muted }}>2</span>
              <span>You&apos;ll receive a confirmation email with the details of your agreement.</span>
            </div>
          </div>
          {(companyEmail || companyPhone) && (
            <div
              className="mt-6 pt-5 flex flex-wrap items-center justify-center gap-4 text-xs"
              style={{ borderTop: `1px solid ${hairline}`, color: muted }}
            >
              <span>Questions?</span>
              {companyEmail && (
                <a href={`mailto:${companyEmail}`} className="inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:no-underline" style={{ color: 'inherit' }}>
                  <Mail size={13} />
                  <span>{companyEmail}</span>
                </a>
              )}
              {companyPhone && (
                <a href={`tel:${companyPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:no-underline" style={{ color: 'inherit' }}>
                  <Phone size={13} />
                  <span>{companyPhone}</span>
                </a>
              )}
            </div>
          )}
        </>
      )}

      {state === 'declined' && (
        <>
          <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
            Quote Declined
          </h3>
          <p className="text-sm mb-4" style={mutedStyle}>
            Noted{signerName ? `, ${signerName}` : ''}.{' '}
            {companyName ? `${companyName} has` : 'We’ve'} been notified.
          </p>
          {(companyEmail || companyPhone) && (
            <div
              className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs"
              style={{ borderTop: `1px solid ${hairline}`, color: muted }}
            >
              <span>Changed your mind?</span>
              {companyEmail && (
                <a href={`mailto:${companyEmail}`} className="inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:no-underline" style={{ color: 'inherit' }}>
                  <Mail size={13} />
                  <span>{companyEmail}</span>
                </a>
              )}
              {companyPhone && (
                <a href={`tel:${companyPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:no-underline" style={{ color: 'inherit' }}>
                  <Phone size={13} />
                  <span>{companyPhone}</span>
                </a>
              )}
            </div>
          )}
        </>
      )}

      {state === 'revision' && (
        <>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
            style={{ backgroundColor: withAlpha(headingColor, 0.1), color: headingColor }}
          >
            <MessageSquare size={18} />
          </div>
          <h3 className="text-2xl tracking-tight mb-2" style={titleStyle}>
            Revision Requested
          </h3>
          <p className="text-sm mb-4" style={mutedStyle}>
            {companyName ? `${companyName} has` : 'We’ve'} been notified and will send a revised quote.
          </p>
          {(companyEmail || companyPhone) && (
            <div
              className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs"
              style={{ borderTop: `1px solid ${hairline}`, color: muted }}
            >
              <span>Need to follow up?</span>
              {companyEmail && (
                <a href={`mailto:${companyEmail}`} className="inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:no-underline" style={{ color: 'inherit' }}>
                  <Mail size={13} />
                  <span>{companyEmail}</span>
                </a>
              )}
              {companyPhone && (
                <a href={`tel:${companyPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:no-underline" style={{ color: 'inherit' }}>
                  <Phone size={13} />
                  <span>{companyPhone}</span>
                </a>
              )}
            </div>
          )}
        </>
      )}

      {state === 'pending' && (
        <>
          {isExpired && (activeAction as string) === 'accept' ? (
            <div className="space-y-4">
              <div
                className="flex items-center justify-center gap-2.5 px-5 py-4 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  color: '#b91c1c',
                  fontFamily: headingFontFamily,
                }}
              >
                <AlertTriangle size={16} className="shrink-0" />
                <span className="font-medium">This quote has expired and can no longer be accepted.</span>
              </div>
              <p className="text-sm" style={mutedStyle}>
                {companyName
                  ? `Contact ${companyName}${companyEmail ? ` at ${companyEmail}` : ''} for an updated quote.`
                  : 'Please contact the sender for an updated quote.'}
              </p>
              {(onDecline || onRequestRevision) && (
                <div
                  className="inline-flex rounded-lg p-1 text-xs"
                  role="tablist"
                  aria-label="Quote actions"
                  style={{ backgroundColor: withAlpha(bodyText, 0.05) }}
                >
                  {onRequestRevision && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeAction === 'revision'}
                      onClick={() => setActiveAction('revision')}
                      className="px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                      style={{
                        outlineColor: headingColor,
                        ...(activeAction === 'revision'
                          ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                          : { color: muted }),
                      }}
                    >
                      Request Changes
                    </button>
                  )}
                  {onDecline && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeAction === 'decline'}
                      onClick={() => setActiveAction('decline')}
                      className="px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                      style={{
                        outlineColor: headingColor,
                        ...(activeAction === 'decline'
                          ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                          : { color: muted }),
                      }}
                    >
                      Decline
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              noValidate
            >
              <h3 className="text-2xl sm:text-3xl tracking-tight mb-2" style={titleStyle}>
                {activeAction === 'accept'
                  ? (acceptHeading || 'Ready to move forward?')
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
                  role="tablist"
                  aria-label="Quote actions"
                  style={{ backgroundColor: withAlpha(bodyText, 0.05) }}
                >
                  {onAccept && !isExpired && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeAction === 'accept'}
                      onClick={() => { setActiveAction('accept'); setConfirmStep(false); setSubmitError(null); }}
                      className={`px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${activeAction === 'accept' ? 'shadow-sm' : ''}`}
                      style={{
                        outlineColor: headingColor,
                        ...(activeAction === 'accept'
                          ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                          : { color: muted }),
                      }}
                    >
                      Accept
                    </button>
                  )}
                  {onRequestRevision && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeAction === 'revision'}
                      onClick={() => { setActiveAction('revision'); setConfirmStep(false); setSubmitError(null); }}
                      className={`px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${activeAction === 'revision' ? 'shadow-sm' : ''}`}
                      style={{
                        outlineColor: headingColor,
                        ...(activeAction === 'revision'
                          ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                          : { color: muted }),
                      }}
                    >
                      Request Changes
                    </button>
                  )}
                  {onDecline && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeAction === 'decline'}
                      onClick={() => { setActiveAction('decline'); setConfirmStep(false); setSubmitError(null); }}
                      className={`px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${activeAction === 'decline' ? 'shadow-sm' : ''}`}
                      style={{
                        outlineColor: headingColor,
                        ...(activeAction === 'decline'
                          ? { backgroundColor: bodyBg, color: headingColor, fontWeight: 600 }
                          : { color: muted }),
                      }}
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
                    className="w-full px-3 py-2.5 rounded-lg text-base md:text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                    style={{
                      border: `1px solid ${hairline}`,
                      backgroundColor: bodyBg,
                      color: bodyText,
                      outlineColor: headingColor,
                    }}
                  />
                </div>
              )}

              {!(requireSignature && activeAction === 'accept') && (
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
                    className="w-full px-3 py-2.5 rounded-lg text-base md:text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                    style={{
                      border: `1px solid ${hairline}`,
                      backgroundColor: bodyBg,
                      color: bodyText,
                      outlineColor: headingColor,
                    }}
                  />
                </div>
              )}

              {requireSignature && activeAction === 'accept' && (
                <div className="mb-6">
                  <label
                    className="block text-2xs tracking-[0.18em] uppercase mb-2"
                    style={{ color: faint, fontFamily: headingFontFamily }}
                  >
                    Your Signature
                  </label>
                  <Suspense fallback={<div className="h-28 sm:h-28 rounded-xl border-2 border-dashed border-edge animate-pulse" />}>
                    <SignatureCapture
                      signerName={signerName}
                      onSignerNameChange={setSignerName}
                      accentColor={headingColor}
                      hairlineColor={hairline}
                      inputBg={bodyBg}
                      inputColor={bodyText}
                      labelColor={faint}
                      labelFont={headingFontFamily}
                      onSignatureChange={handleSignatureChange}
                    />
                  </Suspense>
                </div>
              )}

              {activeAction === 'accept' && totalAmount && (
                <div
                  className="rounded-lg px-4 py-3 mb-4 text-left"
                  style={{
                    backgroundColor: withAlpha(bodyText, 0.03),
                    border: `1px solid ${hairline}`,
                  }}
                >
                  <div className="text-xs mb-0.5" style={{ color: faint }}>
                    {proposalTitle ? `Accepting "${proposalTitle}"` : 'You are accepting'}
                  </div>
                  <div className="text-lg font-semibold tabular-nums" style={{ color: headingColor }}>
                    {totalAmount}
                  </div>
                </div>
              )}

              {submitError && (
                <div
                  className="rounded-lg px-4 py-2.5 mb-4 text-sm text-left"
                  role="alert"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.06)',
                    border: '1px solid rgba(220, 38, 38, 0.2)',
                    color: '#b91c1c',
                  }}
                >
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  submitting ||
                  !signerName.trim() ||
                  (activeAction === 'accept' && !agree) ||
                  (activeAction === 'accept' && requireSignature && !signatureData) ||
                  (activeAction === 'revision' && !reason.trim())
                }
                className="w-full px-6 py-3 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 tracking-wider uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  outlineColor: headingColor,
                  backgroundColor:
                    activeAction === 'accept'
                      ? (acceptButtonColor || headingColor)
                      : activeAction === 'decline'
                        ? (declineButtonColor || withAlpha('#dc2626', 0.85))
                        : (revisionButtonColor || headingColor),
                  color: bodyBg,
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
                  : confirmStep && activeAction === 'accept'
                    ? `Confirm Acceptance${totalAmount ? ` of ${totalAmount}` : ''}`
                    : activeAction === 'accept'
                      ? (acceptButtonLabel || acceptButtonText || 'Accept & Confirm Quote')
                      : activeAction === 'revision'
                        ? (revisionButtonLabel || 'Request Changes')
                        : (declineButtonLabel || 'Decline Quote')}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
