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
  layout?: 'contained' | 'full';
}

export default function TextPagePreview({
  bgColor,
  textColor,
  headingColor,
  fontSize,
  accent,
  borderEnabled,
  borderColor,
  borderRadius,
  layout = 'contained',
}: TextPagePreviewProps) {
  const resolvedHeadingColor = headingColor || textColor;
  const resolvedBorderColor = borderColor || `${textColor}20`;
  const fs = parseInt(fontSize || '14', 10);
  const br = parseInt(borderRadius || '12', 10);
  const isFull = layout === 'full';

  const bodyContent = (
    <>
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
    </>
  );

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-2xl shadow-black/40">
      <div
        className={isFull ? 'p-6' : 'p-6 flex items-start justify-center'}
        style={{ backgroundColor: bgColor, minHeight: 280 }}
      >
        {isFull ? (
          <div className="max-w-full">{bodyContent}</div>
        ) : (
          <div
            className="w-full overflow-hidden"
            style={{
              backgroundColor: bgColor,
              border: borderEnabled ? `1px solid ${resolvedBorderColor}` : 'none',
              borderRadius: `${br}px`,
            }}
          >
            <div className="h-1" style={{ backgroundColor: accent }} />
            <div className="p-5">{bodyContent}</div>
          </div>
        )}
      </div>
    </div>
  );
}