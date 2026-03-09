// components/viewer/FeedbackModal.tsx
'use client';

import { useState } from 'react';
import { X, XCircle, PenLine, CheckCircle2, Loader2 } from 'lucide-react';
import { deriveBorderColor } from '@/hooks/useProposal';

export type FeedbackMode = 'decline' | 'revision';

interface FeedbackModalProps {
  mode:              FeedbackMode;
  title:             string;          // proposal title
  onSubmit:          (name: string, feedback: string) => Promise<void>;
  onClose:           () => void;
  accentColor?:      string;
  bgColor?:          string;
  textColor?:        string;
  acceptTextColor?:  string;
}

const CONFIG = {
  decline: {
    icon:         XCircle,
    iconColor:    '#ef4444',
    iconBg:       '#ef444420',
    label:        'Decline Proposal',
    subtitle:     "We're sorry to hear that. Please let us know why so we can improve.",
    textareaLabel: 'Reason for declining',
    placeholder:  'e.g. The pricing is outside our budget, or the scope doesn\'t match our needs.',
    buttonText:   'Decline Proposal',
    buttonStyle:  { bg: '#ef4444', text: '#ffffff' },
    successTitle: 'Response Recorded',
    successBody:  "Thank you for letting us know. Your feedback has been received.",
  },
  revision: {
    icon:         PenLine,
    iconColor:    '#f59e0b',
    iconBg:       '#f59e0b20',
    label:        'Request Changes',
    subtitle:     "Like the direction, but need a few tweaks first? Tell us what you'd like changed.",
    textareaLabel: 'What would you like changed?',
    placeholder:  'e.g. Could we adjust the timeline on phase 2, and revisit the pricing for the retainer?',
    buttonText:   'Submit Request',
    buttonStyle:  { bg: '#f59e0b', text: '#ffffff' },
    successTitle: 'Feedback Sent',
    successBody:  "Thanks for the feedback. The team will review your notes and be in touch shortly.",
  },
} as const;

export default function FeedbackModal({
  mode,
  title,
  onSubmit,
  onClose,
  accentColor   = '#ff6700',
  bgColor       = '#141414',
  textColor     = '#ffffff',
  acceptTextColor = '#ffffff',
}: FeedbackModalProps) {
  const [name,      setName]      = useState('');
  const [feedback,  setFeedback]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]  = useState(false);

  const cfg    = CONFIG[mode];
  const border = deriveBorderColor(bgColor);
  const Icon   = cfg.icon;

  const isValid = name.trim().length > 0 && feedback.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    await onSubmit(name.trim(), feedback.trim());
    setSubmitting(false);
    setSubmitted(true);
  };

  // ── Success state ────────────────────────────────────────────────────
  if (submitted) {
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
                {cfg.successTitle}
              </h2>
            </div>
            <button onClick={onClose} style={{ color: textColor, opacity: 0.5 }} className="hover:opacity-100 transition-opacity">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <p className="text-sm leading-relaxed" style={{ color: textColor, opacity: 0.75 }}>
              {cfg.successBody}
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

  // ── Form state ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md border"
        style={{ backgroundColor: bgColor, borderColor: border }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: cfg.iconBg }}
            >
              <Icon size={15} style={{ color: cfg.iconColor }} />
            </div>
            <h2
              className="text-lg font-semibold font-[family-name:var(--font-display)]"
              style={{ color: textColor }}
            >
              {cfg.label}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: textColor, opacity: 0.5 }} className="hover:opacity-100 transition-opacity">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: textColor, opacity: 0.65 }}>
            {cfg.subtitle}
            {' '}Regarding{' '}
            <span className="font-medium" style={{ opacity: 1, color: textColor }}>
              &ldquo;{title}&rdquo;
            </span>
            .
          </p>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: textColor, opacity: 0.55 }}>
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{
                backgroundColor: border,
                color:            textColor,
                borderWidth:      1,
                borderStyle:      'solid',
                borderColor:      name.trim() ? `${cfg.iconColor}60` : deriveBorderColor(bgColor),
              }}
            />
          </div>

          {/* Feedback textarea */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: textColor, opacity: 0.55 }}>
              {cfg.textareaLabel}
            </label>
            <textarea
              required
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={cfg.placeholder}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none resize-none"
              style={{
                backgroundColor: border,
                color:            textColor,
                borderWidth:      1,
                borderStyle:      'solid',
                borderColor:      feedback.trim() ? `${cfg.iconColor}60` : deriveBorderColor(bgColor),
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !isValid}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: cfg.buttonStyle.bg, color: cfg.buttonStyle.text }}
          >
            {submitting ? (
              <><Loader2 size={15} className="animate-spin" /> Submitting…</>
            ) : (
              cfg.buttonText
            )}
          </button>
        </form>
      </div>
    </div>
  );
}