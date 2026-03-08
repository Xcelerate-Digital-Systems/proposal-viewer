// components/viewer/PackagesPage.tsx
'use client';

import { ProposalPackages, PackageTier, PackageFeature, PackageFeatureIcon, PackageStyling, normalizePackageStyling, formatAUD } from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor, deriveSurfaceColor } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';
import { Check, CheckCircle2, ArrowRight, Star, Minus } from 'lucide-react';

interface PackagesPageProps {
  packages: ProposalPackages;
  branding: CompanyBranding;
  clientName?: string;
  orientation?: 'portrait' | 'landscape';
}

function formatPrice(amount: number): string {
  const formatted = formatAUD(amount);
  return formatted.replace(/\.00$/, '');
}

/* ─── Feature Icon renderer ──────────────────────────────────────── */

function FeatureIcon({ icon, color, size = 'normal' }: { icon: PackageFeatureIcon; color: string; size?: 'normal' | 'small' }) {
  const px = size === 'small' ? 8 : 12;
  const mt = size === 'small' ? 'mt-[6px]' : 'mt-[5px]';

  switch (icon) {
    case 'check':
      return <Check size={px} className={`shrink-0 ${mt}`} style={{ color }} strokeWidth={3} />;
    case 'checkCircle':
      return <CheckCircle2 size={px} className={`shrink-0 ${mt}`} style={{ color }} strokeWidth={2.5} />;
    case 'arrow':
      return <ArrowRight size={px} className={`shrink-0 ${mt}`} style={{ color }} strokeWidth={3} />;
    case 'star':
      return <Star size={px} className={`shrink-0 ${mt} fill-current`} style={{ color }} strokeWidth={0} />;
    case 'dash':
      return <Minus size={px} className={`shrink-0 ${mt}`} style={{ color }} strokeWidth={3} />;
    case 'dot':
    default:
      return (
        <span
          className={`shrink-0 rounded-full ${size === 'small' ? 'w-1 h-1 mt-[8px]' : 'w-1.5 h-1.5 mt-[7px]'}`}
          style={{ backgroundColor: color }}
        />
      );
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Main PackagesPage                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

export default function PackagesPage({ packages, branding, clientName, orientation }: PackagesPageProps) {
  const isLandscape = orientation === 'landscape';
  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const textColor = branding.sidebar_text_color || '#ffffff';
  const border = deriveBorderColor(bgSecondary);
  const surface = deriveSurfaceColor(bgPrimary, bgSecondary);

  const muted = `${textColor}99`;
  const faint = `${textColor}55`;

  const styling = normalizePackageStyling(packages.styling);
  const titleColor = styling.title_color || textColor;
  const tiers = [...(packages.packages ?? [])]; // Order preserved from DB — sort_order within JSONB tiers is not reliably maintained by the editor

  return (
    <div
      className={`w-full min-h-full flex items-center justify-center ${!isLandscape ? 'py-8 lg:py-12 px-4 sm:px-6' : ''}`}
      style={{
        backgroundColor: branding.bg_image_url ? 'transparent' : bgPrimary,
        ...(isLandscape && { paddingTop: 128, paddingBottom: 64, paddingLeft: 168, paddingRight: 168 }),
      }}
    >
      {/* Mobile font standardisation — below lg breakpoint */}
      <style>{`
        @media (max-width: 1023px) {
          .agv-pkg-title     { font-size: 20px !important; }
          .agv-pkg-card-name { font-size: 18px !important; }
          .agv-pkg-price     { font-size: 20px !important; }
          .agv-pkg-body      { font-size: 16px !important; }
        }
        @media (max-width: 640px) {
          .packages-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className={`w-full ${isLandscape ? 'max-w-[900px]' : 'max-w-[1200px]'}`}>
        {/* Title section */}
        <div className="mb-8 text-center">
          <h1
            className="agv-pkg-title text-2xl sm:text-3xl font-bold tracking-tight"
            style={{
              color: titleColor,
              fontFamily: fontFamily(branding.title_font_family || branding.font_heading, 'system-ui, sans-serif'),
              fontWeight: Number(branding.title_font_weight || branding.font_heading_weight || '700'),
              ...(branding.title_font_size ? { fontSize: `${branding.title_font_size}px` } : {}),
            }}
          >
            {packages.title}
          </h1>
          {clientName && (
            <p className="agv-pkg-body text-sm mt-1.5" style={{ color: muted }}>
              Prepared for {clientName}
            </p>
          )}
          {packages.intro_text && (
            <p className="agv-pkg-body text-sm leading-relaxed mt-4 max-w-[700px] mx-auto" style={{ color: muted }}>
              {packages.intro_text}
            </p>
          )}
        </div>

        {/* Package cards grid */}
        <div
          className="packages-grid grid gap-4 sm:gap-5 mx-auto"
          style={{
            gridTemplateColumns: tiers.length === 1
              ? '1fr'
              : tiers.length === 2
                ? 'repeat(2, 1fr)'
                : `repeat(${Math.min(tiers.length, 3)}, 1fr)`,
          }}
        >
          {tiers.map((tier) => (
            <PackageCard
              key={tier.id}
              tier={tier}
              accent={accent}
              textColor={textColor}
              muted={muted}
              faint={faint}
              bgSecondary={bgSecondary}
              border={border}
              surface={surface}
              styling={styling}
            />
          ))}
        </div>

        {/* Footer text */}
        {packages.footer_text && (
          <div className="mt-6 text-center">
            <p className="text-xs leading-relaxed" style={{ color: faint }}>
              {packages.footer_text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Individual Package Card ────────────────────────────────────── */

interface PackageCardProps {
  tier: PackageTier;
  accent: string;
  textColor: string;
  muted: string;
  faint: string;
  bgSecondary: string;
  border: string;
  surface: string;
  styling: PackageStyling;
}

function PackageCard({ tier, accent, textColor, muted, faint, bgSecondary, border, surface, styling }: PackageCardProps) {
  const tierAccent = tier.highlight_color || accent;

  const cardBg = styling.card_bg_independent && tier.card_bg_color
    ? tier.card_bg_color
    : styling.card_bg_color || bgSecondary;

  const cardText = styling.card_text_independent && tier.card_text_color
    ? tier.card_text_color
    : styling.card_text_color || textColor;

  const cardMuted = `${cardText}99`;
  const cardFaint = `${cardText}55`;

  const recBg = tierAccent;
  const recText = styling.recommended_text_color || '#ffffff';

  const borderRadius = `${styling.border_radius}px`;
  const borderW = styling.border_width ?? 1;
  const cardBorder = borderW > 0
    ? `${tier.is_recommended ? Math.max(borderW, 2) : borderW}px solid ${tier.is_recommended ? tierAccent : border}`
    : 'none';

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{
        backgroundColor: cardBg,
        borderRadius,
        border: cardBorder,
      }}
    >
      {/* Recommended badge */}
      {tier.is_recommended && (
        <div
          className="px-4 py-2"
          style={{ backgroundColor: recBg }}
        >
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: recText }}
          >
            Recommended Package
          </span>
        </div>
      )}

      {/* Accent bar for non-recommended tiers */}
      {!tier.is_recommended && (
        <div className="h-1" style={{ backgroundColor: tierAccent }} />
      )}

      {/* Card content */}
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        {/* Package name */}
        <h2
          className="agv-pkg-card-name text-lg sm:text-xl font-bold tracking-tight font-[family-name:var(--font-display)]"
          style={{ color: cardText }}
        >
          {tier.name}
        </h2>

        {/* Price section */}
        <div className="mt-3 mb-4">
          {tier.price_prefix && (
            <span
              className="block text-[10px] font-semibold uppercase tracking-widest mb-0.5"
              style={{ color: cardText }}
            >
              {tier.price_prefix}
            </span>
          )}
          <div className="flex items-baseline gap-0.5">
            <span
              className="agv-pkg-price text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: tierAccent }}
            >
              {formatPrice(tier.price)}
            </span>
            {tier.price_suffix && (
              <span
                className="agv-pkg-body text-sm sm:text-base font-semibold"
                style={{ color: tierAccent }}
              >
                {tier.price_suffix}
              </span>
            )}
          </div>
        </div>

        {/* Conditions */}
        {tier.conditions.length > 0 && (
          <div className="mb-4 space-y-0.5">
            {tier.conditions.map((condition, idx) => (
              <p
                key={idx}
                className="agv-pkg-body text-xs font-semibold uppercase tracking-wide"
                style={{ color: cardText }}
              >
                {condition}
              </p>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="mb-4" style={{ borderBottom: `1px solid ${cardFaint}` }} />

        {/* Features list */}
        <div className="flex-1 space-y-2.5">
          {tier.features.map((feature, idx) => (
            <FeatureItem
              key={idx}
              feature={feature}
              textColor={cardText}
              muted={cardMuted}
              faint={cardFaint}
              accent={tierAccent}
              surface={surface}
              featureIcon={styling.feature_icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature Item ───────────────────────────────────────────────── */

interface FeatureItemProps {
  feature: PackageFeature;
  textColor: string;
  muted: string;
  faint: string;
  accent: string;
  surface: string;
  featureIcon: PackageFeatureIcon;
}

function FeatureItem({ feature, textColor, muted, faint, accent, surface, featureIcon }: FeatureItemProps) {
  const hasChildren = feature.children.length > 0;

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <FeatureIcon icon={featureIcon} color={accent} size="normal" />
        <span className="agv-pkg-body text-sm leading-relaxed" style={{ color: textColor }}>
          {feature.bold_prefix ? (
            <>
              <strong className="font-semibold">{feature.bold_prefix}</strong>
              {feature.text.startsWith(feature.bold_prefix)
                ? feature.text.slice(feature.bold_prefix.length)
                : ` ${feature.text}`}
            </>
          ) : (
            feature.text
          )}
        </span>
      </div>

      {hasChildren && (
        <div className="ml-4 mt-1.5 space-y-1.5">
          {feature.children.map((child, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <FeatureIcon icon={featureIcon} color={faint} size="small" />
              <span className="text-xs leading-relaxed" style={{ color: muted }}>
                {child}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}