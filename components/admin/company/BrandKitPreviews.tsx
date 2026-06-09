// components/admin/company/BrandKitPreviews.tsx
'use client';

import { CheckCircle2, XCircle, PenLine, Check, Square } from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';

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

// ─── Content Page Preview ────────────────────────────────────────────────

interface ContentPagePreviewProps {
  bgColor: string;
  textColor: string;
  headingColor: string | null;
  accentColor: string;
  fontHeading?: string | null;
  fontBody?: string | null;
  fontHeadingWeight?: string | null;
  fontBodyWeight?: string | null;
}

export function ContentPagePreview({
  bgColor,
  textColor,
  headingColor,
  accentColor,
  fontHeading,
  fontBody,
  fontHeadingWeight,
  fontBodyWeight,
}: ContentPagePreviewProps) {
  const heading = headingColor || textColor;
  const muted = withAlpha(textColor, 0.6);
  const bodyFont = fontFamily(fontBody);
  const headFont = fontFamily(fontHeading);

  return (
    <div
      className="rounded-2xl overflow-hidden border shadow-lg"
      style={{ borderColor: withAlpha(textColor, 0.08) }}
    >
      <div className="py-6 px-6" style={{ backgroundColor: bgColor, minHeight: 240 }}>
        <h3
          className="font-semibold tracking-tight mb-4"
          style={{
            color: heading,
            fontSize: 16,
            fontFamily: headFont,
            fontWeight: Number(fontHeadingWeight || '700'),
            lineHeight: 1.3,
          }}
        >
          Executive Summary
        </h3>

        <p style={{ color: textColor, fontSize: 12, lineHeight: 1.8, margin: '0.4em 0', fontFamily: bodyFont, fontWeight: Number(fontBodyWeight || '400') }}>
          Thank you for considering our proposal. We&apos;re excited to partner with you on this project.
        </p>
        <p style={{ color: muted, fontSize: 12, lineHeight: 1.8, margin: '0.4em 0', fontFamily: bodyFont }}>
          Below you&apos;ll find our recommended approach, timeline, and investment breakdown.
        </p>

        <ul style={{ color: textColor, paddingLeft: '1.5em', margin: '0.5em 0', listStyleType: 'disc' }}>
          {['Discovery & research', 'Strategy development', 'Implementation'].map((item, i) => (
            <li key={i} style={{ margin: '0.2em 0', fontSize: 12, lineHeight: 1.7, fontFamily: bodyFont }}>
              {item}
            </li>
          ))}
        </ul>

        <blockquote style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: '0.8em', margin: '0.6em 0', color: muted, fontStyle: 'italic', fontSize: 12, fontFamily: bodyFont }}>
          We believe great work starts with understanding your goals.
        </blockquote>
      </div>
    </div>
  );
}

// ─── Decision Page Preview ───────────────────────────────────────────────

interface DecisionPagePreviewProps {
  bgColor: string;
  textColor: string;
  headingColor: string;
  acceptButtonColor: string;
  declineButtonColor: string;
  revisionButtonColor: string;
  checkboxColor: string;
  acceptTextColor: string;
  fontHeading?: string | null;
  fontBody?: string | null;
}

export function DecisionPagePreview({
  bgColor,
  textColor,
  headingColor,
  acceptButtonColor,
  declineButtonColor,
  revisionButtonColor,
  checkboxColor,
  acceptTextColor,
  fontHeading,
  fontBody,
}: DecisionPagePreviewProps) {
  const muted = withAlpha(textColor, 0.55);
  const faint = withAlpha(textColor, 0.4);
  const hairline = withAlpha(textColor, 0.1);
  const headFont = fontFamily(fontHeading);
  const bodyFont = fontFamily(fontBody);

  return (
    <div
      className="rounded-2xl overflow-hidden border shadow-lg"
      style={{ borderColor: withAlpha(textColor, 0.08) }}
    >
      <div className="py-5 px-5" style={{ backgroundColor: bgColor, minHeight: 240 }}>
        {/* Next steps */}
        <p
          className="tracking-[0.15em] uppercase mb-3"
          style={{ color: faint, fontFamily: headFont, fontSize: 9 }}
        >
          Next Steps
        </p>
        <ol className="space-y-1.5 mb-4">
          {['Review the proposal details', 'Accept, decline, or request changes', 'Sign and we\'ll get started'].map((step, i) => (
            <li key={i} className="flex items-start gap-2" style={{ fontSize: 11, lineHeight: 1.5, fontFamily: bodyFont }}>
              <span className="shrink-0 tabular-nums font-medium mt-px" style={{ color: muted, fontSize: 10 }}>
                0{i + 1}
              </span>
              <span style={{ color: textColor }}>{step}</span>
            </li>
          ))}
        </ol>

        <div className="h-px mb-4" style={{ backgroundColor: hairline }} />

        {/* Decision heading */}
        <h4
          className="font-semibold mb-3"
          style={{ color: headingColor, fontSize: 14, fontFamily: headFont }}
        >
          Your Decision
        </h4>

        {/* Checkbox */}
        <label className="flex items-start gap-2 mb-4 cursor-default" style={{ fontSize: 11, color: textColor, fontFamily: bodyFont }}>
          <span className="shrink-0 mt-0.5">
            <Square size={14} style={{ color: checkboxColor }} strokeWidth={2} />
          </span>
          <span>I have read and agree to the terms outlined in this proposal.</span>
        </label>

        {/* Action buttons */}
        <div className="flex gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: acceptButtonColor, color: acceptTextColor }}
          >
            <CheckCircle2 size={12} />
            Accept
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: withAlpha(declineButtonColor, 0.08), color: declineButtonColor, border: `1px solid ${withAlpha(declineButtonColor, 0.2)}` }}
          >
            <XCircle size={12} />
            Decline
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: withAlpha(revisionButtonColor, 0.08), color: revisionButtonColor, border: `1px solid ${withAlpha(revisionButtonColor, 0.2)}` }}
          >
            <PenLine size={12} />
            Changes
          </div>
        </div>
      </div>
    </div>
  );
}
