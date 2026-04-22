'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import CompleteFeedbackModal from './CompleteFeedbackModal';

interface CompleteFeedbackButtonProps {
  shareToken: string;
  reviewerName: string;
  reviewerEmail: string;
  accentColor?: string;
  /** Hide when true — e.g. while the identity onboarding modal is open. */
  hidden?: boolean;
}

const ACK_PREFIX = 'av-review-complete-';

/**
 * Fixed bottom-left "Let the team know you finished reviewing" button for
 * public review pages. Once a reviewer submits, the button persists a
 * done state in localStorage per share-token so refreshing keeps it
 * disabled for that browser.
 *
 * Lives outside the chrome until PR 8 moves it into a left sidebar.
 */
export default function CompleteFeedbackButton({
  shareToken,
  reviewerName,
  reviewerEmail,
  accentColor = '#017C87',
  hidden = false,
}: CompleteFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(ACK_PREFIX + shareToken)) {
      setSubmitted(true);
    }
  }, [shareToken]);

  if (hidden) return null;

  const markSubmitted = () => {
    try {
      window.localStorage.setItem(ACK_PREFIX + shareToken, new Date().toISOString());
    } catch {
      // ignore
    }
    setSubmitted(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !submitted && setOpen(true)}
        disabled={submitted}
        className={`fixed bottom-5 left-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold shadow-lg transition-all ${
          submitted
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
            : 'bg-white text-gray-800 border border-gray-200 hover:shadow-xl hover:-translate-y-0.5'
        }`}
      >
        {submitted ? (
          <>
            <Check size={14} className="text-emerald-600" />
            Review submitted
          </>
        ) : (
          <>
            Let the team know you finished reviewing
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ArrowRight size={12} />
            </span>
          </>
        )}
      </button>

      {open && (
        <CompleteFeedbackModal
          shareToken={shareToken}
          reviewerName={reviewerName}
          reviewerEmail={reviewerEmail}
          accentColor={accentColor}
          onClose={() => setOpen(false)}
          onSubmitted={markSubmitted}
        />
      )}
    </>
  );
}
