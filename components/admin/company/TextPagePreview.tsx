// components/admin/company/TextPagePreview.tsx
'use client';

interface TextPagePreviewProps {
  bgColor: string;
  textColor: string;
  headingColor: string;
  fontSize: string;
  accent: string;
  borderEnabled: boolean;
  borderColor: string;
  borderRadius: string;
  layout?: 'contained' | 'full'; // kept for backward compat but ignored — always full
}

export default function TextPagePreview({
  bgColor,
  textColor,
  headingColor,
  fontSize,
  accent,
}: TextPagePreviewProps) {
  const resolvedHeadingColor = headingColor || textColor;
  const fs = parseInt(fontSize || '14', 10);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-2xl shadow-black/40">
      <div
        className="p-6"
        style={{ backgroundColor: bgColor, minHeight: 280 }}
      >
        <h3
          className="font-bold mb-3"
          style={{
            color: resolvedHeadingColor,
            fontSize: 18,
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            lineHeight: 1.3,
          }}
        >
          Executive Summary
        </h3>

        <p
          style={{
            color: textColor,
            fontSize: `${fs}px`,
            lineHeight: 1.8,
            margin: '0 0 0.5em',
          }}
        >
          Thank you for considering our proposal. We&apos;re excited to partner with you on this project.
        </p>

        <p
          style={{
            color: `${textColor}99`,
            fontSize: `${Math.max(fs - 1, 10)}px`,
            lineHeight: 1.7,
            margin: '0 0 1em',
          }}
        >
          Below you&apos;ll find our recommended approach, timeline, and investment breakdown.
        </p>

        <div style={{ paddingLeft: '1.2em', marginBottom: '0.8em' }}>
          {['Discovery & research', 'Strategy development', 'Implementation'].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{
                color: textColor,
                fontSize: `${fs}px`,
                lineHeight: 2,
              }}
            >
              <span style={{ color: `${textColor}60` }}>•</span>
              {item}
            </div>
          ))}
        </div>

        <div
          style={{
            borderLeft: `3px solid ${accent}`,
            paddingLeft: '0.8em',
            color: `${textColor}80`,
            fontSize: `${Math.max(fs - 1, 10)}px`,
            fontStyle: 'italic',
            lineHeight: 1.6,
          }}
        >
          &ldquo;We believe great work starts with understanding your goals.&rdquo;
        </div>
      </div>
    </div>
  );
}