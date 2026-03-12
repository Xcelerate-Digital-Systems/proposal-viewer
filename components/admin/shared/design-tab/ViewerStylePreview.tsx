// components/admin/shared/design-tab/ViewerStylePreview.tsx
'use client';

import { FileText, List, DollarSign, Package } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ViewerStylePreviewProps {
  /* ── Text page styling ──────────────────────────────────── */
  tpBgColor: string;
  tpTextColor: string;
  tpHeadingColor: string;
  fontSize: string;
  accent: string;
  /* ── General branding (pricing / packages / toc) ────────── */
  bgPrimary: string;
  bgSecondary: string;
  sidebarTextColor: string;
  coverTextColor: string;
  coverSubtitleColor: string;
  /* ── Fonts ──────────────────────────────────────────────── */
  titleFontFamily?: string | null;
  titleFontWeight?: string | null;
  titleFontSize?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: 'text', label: 'Text Page', icon: FileText },
  { key: 'toc', label: 'Contents', icon: List },
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'packages', label: 'Packages', icon: Package },
] as const;

type TabKey = typeof TABS[number]['key'];

/* ------------------------------------------------------------------ */
/*  Helpers (mirrors useProposal deriveBorderColor / deriveSurfaceColor) */
/* ------------------------------------------------------------------ */

function deriveBorder(bg: string): string {
  const hex = bg.replace('#', '');
  if (hex.length < 6) return '#333333';
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 22);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 22);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 22);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function deriveSurface(p: string, s: string): string {
  const ph = p.replace('#', '');
  const sh = s.replace('#', '');
  if (ph.length < 6 || sh.length < 6) return '#1e1e1e';
  const r = Math.round((parseInt(ph.slice(0, 2), 16) + parseInt(sh.slice(0, 2), 16)) / 2 + 4);
  const g = Math.round((parseInt(ph.slice(2, 4), 16) + parseInt(sh.slice(2, 4), 16)) / 2 + 4);
  const b = Math.round((parseInt(ph.slice(4, 6), 16) + parseInt(sh.slice(4, 6), 16)) / 2 + 4);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

/** Mirrors lib/google-fonts fontFamily() */
function ff(font: string | null | undefined, fallback = 'system-ui, sans-serif'): string {
  if (!font) return fallback;
  return `'${font}', ${fallback}`;
}

/** Shared title style — matches how all real viewer pages render titles */
function titleStyle(props: ViewerStylePreviewProps, color: string): React.CSSProperties {
  return {
    color,
    fontSize: props.titleFontSize ? `${props.titleFontSize}px` : 18,
    fontWeight: Number(props.titleFontWeight || '700'),
    fontFamily: ff(props.titleFontFamily || props.fontHeading),
    lineHeight: 1.3,
  };
}

/* ================================================================== */
/*  Mock: Text Page                                                    */
/*  Real: components/viewer/TextPage.tsx                                */
/*  bg: tpBgColor · text: tpTextColor · headings: tpHeadingColor       */
/*  body font: fontBody · title: titleFontFamily || fontHeading        */
/* ================================================================== */

function TextPageMock(props: ViewerStylePreviewProps) {
  const headingColor = props.tpHeadingColor || props.tpTextColor;
  const fs = parseInt(props.fontSize || '14', 10);
  const bodyFont = ff(props.fontBody);
  const muted = `${props.tpTextColor}99`;

  return (
    <div
      className="py-8 px-8"
      style={{ backgroundColor: props.tpBgColor, minHeight: 280 }}
    >
      <div className="mb-6">
        <h3 className="font-bold tracking-tight" style={titleStyle(props, headingColor)}>
          Executive Summary
        </h3>
      </div>

      <p style={{ color: props.tpTextColor, fontSize: `${fs}px`, lineHeight: 1.8, margin: '0.5em 0', fontFamily: bodyFont }}>
        Thank you for considering our proposal. We&apos;re excited to partner with you on this project.
      </p>
      <p style={{ color: muted, fontSize: `${fs}px`, lineHeight: 1.8, margin: '0.5em 0', fontFamily: bodyFont }}>
        Below you&apos;ll find our recommended approach, timeline, and investment breakdown.
      </p>

      <ul style={{ color: props.tpTextColor, paddingLeft: '1.5em', margin: '0.5em 0', listStyleType: 'disc' }}>
        {['Discovery & research', 'Strategy development', 'Implementation'].map((item, i) => (
          <li key={i} style={{ margin: '0.25em 0', fontSize: fs, lineHeight: 1.7, fontFamily: bodyFont }}>
            {item}
          </li>
        ))}
      </ul>

      <blockquote style={{ borderLeft: `3px solid ${props.accent}`, paddingLeft: '1em', margin: '0.5em 0', color: muted, fontStyle: 'italic', fontSize: `${fs}px`, fontFamily: bodyFont }}>
        We believe great work starts with understanding your goals.
      </blockquote>
    </div>
  );
}

/* ================================================================== */
/*  Mock: Table of Contents                                            */
/*  Real: components/viewer/TocPage.tsx                                */
/*  bg: bgPrimary · text: cover_text_color · muted: cover_subtitle    */
/*  title: heading font, UPPERCASE, font-black, last word = accent    */
/*  entries: heading font, UPPERCASE, bold, accent underline bars      */
/*  groups: body font, UPPERCASE, tiny tracking                        */
/* ================================================================== */

function TocMock(props: ViewerStylePreviewProps) {
  const text = props.coverTextColor;
  const subtitle = props.coverSubtitleColor;
  const accent = props.accent;
  const headingFont = ff(props.titleFontFamily || props.fontHeading);
  const bodyFont = ff(props.fontBody);

  const tocItems = [
    { label: 'Executive Summary', page: 2, isGroup: false, indent: 0 },
    { label: 'Our Approach', page: 3, isGroup: false, indent: 0 },
    { label: 'Discovery', page: 4, isGroup: false, indent: 1 },
    { label: 'Strategy', page: 5, isGroup: false, indent: 1 },
    { label: 'Deliverables', page: 0, isGroup: true, indent: 0 },
    { label: 'Project Investment', page: 6, isGroup: false, indent: 0 },
    { label: 'Timeline', page: 7, isGroup: false, indent: 0 },
  ];

  return (
    <div
      className="flex items-center justify-center py-10 px-8"
      style={{ backgroundColor: props.bgPrimary, minHeight: 280 }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1
            className="text-xl font-black uppercase leading-tight"
            style={{
              fontFamily: headingFont,
              color: text,
              fontWeight: Number(props.titleFontWeight || '900'),
              ...(props.titleFontSize ? { fontSize: `${props.titleFontSize}px` } : {}),
            }}
          >
            Table of<br />
            <span style={{ color: accent }}>Contents</span>
          </h1>
        </div>

        <div>
          {tocItems.map((item, idx) => {
            if (item.isGroup) {
              return (
                <div key={idx} className="mt-6 mb-1">
                  <span
                    className="text-[9px] font-bold uppercase"
                    style={{ color: subtitle, letterSpacing: '0.2em', fontFamily: bodyFont }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            }

            return (
              <div key={idx} style={{ paddingLeft: item.indent > 0 ? 24 : 0 }}>
                <div className="flex items-center justify-between py-2.5">
                  <span
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: text, fontFamily: headingFont }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-xs font-bold tabular-nums ml-6 shrink-0"
                    style={{ color: text, fontFamily: headingFont }}
                  >
                    {item.page}
                  </span>
                </div>
                <div
                  className="h-[3px] rounded-full"
                  style={{ backgroundColor: accent, width: 28 }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Mock: Pricing Page                                                 */
/*  Real: components/viewer/PricingPage.tsx                            */
/*  bg outer: bgPrimary · card: bgSecondary · text: sidebar_text      */
/*  accent bar at top of card · surface for table header/footer        */
/*  alternating row backgrounds · total in accent                      */
/* ================================================================== */

function PricingMock(props: ViewerStylePreviewProps) {
  const text = props.sidebarTextColor;
  const muted = `${text}99`;
  const faint = `${text}55`;
  const border = deriveBorder(props.bgSecondary);
  const surface = deriveSurface(props.bgPrimary, props.bgSecondary);
  const accent = props.accent;

  const items = [
    { name: 'Discovery & Research', amount: '$2,500' },
    { name: 'UX/UI Design', amount: '$8,000' },
    { name: 'Development', amount: '$12,000' },
  ];

  return (
    <div
      className="flex items-center justify-center py-8 px-4"
      style={{ backgroundColor: props.bgPrimary, minHeight: 280 }}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{ backgroundColor: props.bgSecondary, border: `1px solid ${border}` }}
      >
        <div className="h-1" style={{ backgroundColor: accent }} />

        <div className="p-5">
          <div className="mb-4">
            <h3 className="font-bold tracking-tight" style={titleStyle(props, text)}>
              Project Investment
            </h3>
            <p className="text-xs mt-1" style={{ color: muted }}>Prepared for Client Name</p>
          </div>

          <p className="text-[11px] leading-relaxed mb-4" style={{ color: muted }}>
            The following costs are based on the agreed scope of works outlined within this proposal.
          </p>

          <div className="mb-4">
            <div
              className="flex items-center justify-between px-3 py-2 text-[9px] font-semibold uppercase tracking-wider rounded-t-lg"
              style={{ backgroundColor: surface, color: faint }}
            >
              <span>Description</span>
              <span>Amount</span>
            </div>

            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5"
                style={{
                  borderBottom: `1px solid ${border}`,
                  backgroundColor: i % 2 === 1 ? `${surface}80` : 'transparent',
                }}
              >
                <span style={{ color: text, fontSize: 11, fontWeight: 500 }}>{item.name}</span>
                <span style={{ color: text, fontSize: 11, fontWeight: 600 }}>{item.amount}</span>
              </div>
            ))}

            <div className="rounded-b-lg overflow-hidden" style={{ backgroundColor: surface }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${border}` }}>
                <span style={{ color: muted, fontSize: 11 }}>Subtotal</span>
                <span style={{ color: text, fontSize: 11, fontWeight: 600 }}>$22,500</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${border}` }}>
                <span style={{ color: muted, fontSize: 11 }}>GST (10%)</span>
                <span style={{ color: text, fontSize: 11, fontWeight: 600 }}>$2,250</span>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span style={{ color: text, fontSize: 13, fontWeight: 700 }}>Total (inc. tax)</span>
                <span style={{ color: accent, fontSize: 15, fontWeight: 700 }}>$24,750</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Mock: Packages Page                                                */
/*  Real: components/viewer/PackagesPage.tsx                           */
/*  bg outer: bgPrimary · card: bgSecondary · text: sidebar_text      */
/*  recommended badge in accent bg · accent bar on non-recommended     */
/*  price in accent · feature bullets with accent dots                 */
/* ================================================================== */

function PackagesMock(props: ViewerStylePreviewProps) {
  const text = props.sidebarTextColor;
  const muted = `${text}99`;
  const border = deriveBorder(props.bgSecondary);
  const accent = props.accent;

  const tiers = [
    { name: 'Starter', price: '$4,500', recommended: false, features: ['5 pages', 'Basic SEO', 'Mobile responsive'] },
    { name: 'Professional', price: '$8,500', recommended: true, features: ['10 pages', 'Advanced SEO', 'CMS integration', 'Analytics setup'] },
  ];

  return (
    <div
      className="flex items-center justify-center py-8 px-4"
      style={{ backgroundColor: props.bgPrimary, minHeight: 280 }}
    >
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <h3 className="font-bold tracking-tight" style={titleStyle(props, text)}>
            Choose Your Package
          </h3>
          <p className="text-[11px] mt-1.5" style={{ color: muted }}>
            Select the option that best suits your needs.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className="overflow-hidden flex flex-col"
              style={{
                backgroundColor: props.bgSecondary,
                border: tier.recommended ? `2px solid ${accent}` : `1px solid ${border}`,
              }}
            >
              {tier.recommended && (
                <div className="px-3 py-1.5" style={{ backgroundColor: accent }}>
                  <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Recommended
                  </span>
                </div>
              )}
              {!tier.recommended && (
                <div className="h-1" style={{ backgroundColor: accent }} />
              )}

              <div className="p-3 flex flex-col flex-1">
                <p style={{ color: text, fontSize: 13, fontWeight: 700 }}>{tier.name}</p>
                <div className="mt-2 mb-3">
                  <span className="text-xl font-bold tracking-tight" style={{ color: accent }}>
                    {tier.price}
                  </span>
                </div>
                <div className="mb-3" style={{ borderBottom: `1px solid ${border}` }} />
                <div className="space-y-2">
                  {tier.features.map((f, fi) => (
                    <div key={fi} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]" style={{ backgroundColor: accent }} />
                      <span style={{ fontSize: 10, color: text, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export { TABS };
export type { TabKey, ViewerStylePreviewProps };

export function ViewerStylePreviewTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (key: TabKey) => void;
}) {
  return (
    <div className="flex gap-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
              isActive
                ? 'bg-teal/10 text-teal'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon size={10} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ViewerStylePreview({
  activeTab,
  ...props
}: ViewerStylePreviewProps & { activeTab: TabKey }) {
  return (
    <>
      {activeTab === 'text' && <TextPageMock {...props} />}
      {activeTab === 'toc' && <TocMock {...props} />}
      {activeTab === 'pricing' && <PricingMock {...props} />}
      {activeTab === 'packages' && <PackagesMock {...props} />}
    </>
  );
}