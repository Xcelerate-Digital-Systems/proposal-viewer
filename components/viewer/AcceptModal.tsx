// components/viewer/AcceptModal.tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, X, Loader2, ExternalLink } from 'lucide-react';
import { deriveBorderColor } from '@/hooks/useProposal';
import { isValidHttpUrl } from '@/lib/sanitize';

type PostAcceptAction = 'redirect' | 'message' | null;

interface AcceptModalProps {
  title: string;
  onAccept: (name: string) => Promise<void>;
  onClose: () => void;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  acceptTextColor?: string;
  buttonText?: string;
  postAcceptAction?: PostAcceptAction;
  postAcceptRedirectUrl?: string | null;
  postAcceptMessage?: string | null;
}

export default function AcceptModal({
  title,
  onAccept,
  onClose,
  accentColor = '#ff6700',
  bgColor = '#141414',
  textColor = '#ffffff',
  acceptTextColor = '#ffffff',
  buttonText,
  postAcceptAction,
  postAcceptRedirectUrl,
  postAcceptMessage,
}: AcceptModalProps) {
  const [name, setName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const border = deriveBorderColor(bgColor);
  const label = buttonText || 'Approve & Continue';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAccepting(true);

    await onAccept(name);

    // Handle post-accept action
    if (postAcceptAction === 'redirect' && postAcceptRedirectUrl && isValidHttpUrl(postAcceptRedirectUrl)) {
      setRedirecting(true);
      setAccepting(false);
      // Brief delay so the client sees the redirect message
      setTimeout(() => {
        window.location.href = postAcceptRedirectUrl;
      }, 1200);
      return;
    }

    if (postAcceptAction === 'message' && postAcceptMessage) {
      setAccepting(false);
      setAccepted(true);
      return;
    }

    // Default: close the modal
    setAccepting(false);
    onClose();
  };

  // ── Redirecting state ────────────────────────────────────────────────
  if (redirecting) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div
          className="rounded-2xl shadow-2xl w-full max-w-md border p-8 flex flex-col items-center gap-4 text-center"
          style={{ backgroundColor: bgColor, borderColor: border }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
            <Loader2 size={24} className="animate-spin" style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-base font-semibold mb-1" style={{ color: textColor }}>
              Approved!
            </p>
            <p className="text-sm opacity-60" style={{ color: textColor }}>
              Redirecting you to the next step…
            </p>
          </div>
          {postAcceptRedirectUrl && isValidHttpUrl(postAcceptRedirectUrl) && (
            <a
              href={postAcceptRedirectUrl}
              className="flex items-center gap-1.5 text-xs underline opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: textColor }}
            >
              <ExternalLink size={11} />
              Click here if you are not redirected
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Custom message success state ─────────────────────────────────────
  if (accepted && postAcceptMessage) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div
          className="rounded-2xl shadow-2xl w-full max-w-md border"
          style={{ backgroundColor: bgColor, borderColor: border }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: border }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} style={{ color: accentColor }} />
              <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]" style={{ color: textColor }}>
                Proposal Approved
              </h2>
            </div>
            <button onClick={onClose} style={{ color: textColor, opacity: 0.5 }} className="hover:opacity-100 transition-opacity">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <p className="text-sm leading-relaxed" style={{ color: textColor }}>
              {postAcceptMessage}
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor, color: acceptTextColor }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Default: name capture form ────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md border"
        style={{ backgroundColor: bgColor, borderColor: border }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: border }}>
          <h2
            className="text-lg font-semibold font-[family-name:var(--font-display)]"
            style={{ color: textColor }}
          >
            {label}
          </h2>
          <button onClick={onClose} style={{ color: textColor, opacity: 0.5 }} className="hover:opacity-100 transition-opacity">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm mb-4" style={{ color: textColor }}>
            By confirming below, you acknowledge that you&rsquo;ve reviewed
            &ldquo;<span className="font-medium">{title}</span>&rdquo;
            and would like to proceed with the next steps.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" style={{ color: textColor }}>
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name to confirm"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{
                backgroundColor: border,
                color: textColor,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: name.trim()
                  ? `${accentColor}80`
                  : deriveBorderColor(bgColor),
              }}
            />
          </div>

          {/* Show hint if redirect is configured */}
          {postAcceptAction === 'redirect' && postAcceptRedirectUrl && (
            <p className="text-xs mb-4 opacity-50 flex items-center gap-1.5" style={{ color: textColor }}>
              <ExternalLink size={10} />
              You&apos;ll be redirected to the next step after approving.
            </p>
          )}

          <button
            type="submit"
            disabled={accepting || !name.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: accentColor, color: acceptTextColor }}
          >
            {accepting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Confirming…
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                {label}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}