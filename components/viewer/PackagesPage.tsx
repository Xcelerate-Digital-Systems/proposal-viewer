// components/viewer/PackagesPage.tsx
'use client';

import { ProposalPackages, PackageTier, PackageFeature, formatAUD } from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor, deriveSurfaceColor } from '@/hooks/useProposal';

interface PackagesPageProps {
  packages: ProposalPackages;
  branding: CompanyBranding;
  clientName?: string;
}

/**
 * Format price for display — strips trailing .00 for whole numbers.
 * e.g. 1500 → "$1,500", 1500.50 → "$1,500.50"
 */
function formatPrice(amount: number): string {
  const formatted = formatAUD(amount);
  // Remove .00 for cleaner display on whole numbers
  return formatted.replace(/\.00$/, '');
}

export default function PackagesPage({ packages, branding, clientName }: PackagesPageProps) {
  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const textColor = branding.sidebar_text_color || '#ffffff';
  const border = deriveBorderColor(bgSecondary);
  const surface = deriveSurfaceColor(bgPrimary, bgSecondary);

  const muted = `${textColor}99`;
  const faint = `${textColor}55`;

  const tiers = [...packages.packages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div
      className="w-full min-h-full flex items-center justify-center py-8 lg:py-12 px-4 sm:px-6"
      style={{ backgroundColor: branding.bg_image_url ? 'transparent' : bgPrimary }}
    >
      <div className="w-full max-w-[1200px]">
        {/* Title section */}
        <div className="mb-8 text-center">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]"
            style={{ color: textColor }}
          >
            {packages.title}
          </h1>
          {clientName && (
            <p className="text-sm mt-1.5" style={{ color: muted }}>
              Prepared for {clientName}
            </p>
          )}
          {packages.intro_text && (
            <p className="text-sm leading-relaxed mt-4 max-w-[700px] mx-auto" style={{ color: muted }}>
              {packages.intro_text}
            </p>
          )}
        </div>

        {/* Package cards grid */}
        <div
          className="grid gap-4 sm:gap-5 mx-auto"
          style={{
            maxWidth: tiers.length === 1
              ? '400px'
              : tiers.length === 2
                ? '800px'
                : '1200px',
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
            />
          ))}
        </div>

        {/* Responsive stacking — on small screens, override grid to single column */}
        <style>{`
          @media (max-width: 640px) {
            .packages-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* Footer text / disclaimers */}
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
}

function PackageCard({ tier, accent, textColor, muted, faint, bgSecondary, border, surface }: PackageCardProps) {
  const tierAccent = tier.highlight_color || accent;

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{
        backgroundColor: bgSecondary,
        border: tier.is_recommended ? `2px solid ${tierAccent}` : `1px solid ${border}`,
      }}
    >
      {/* Recommended badge */}
      {tier.is_recommended && (
        <div
          className="px-4 py-2"
          style={{ backgroundColor: tierAccent }}
        >
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: '#ffffff' }}
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
          className="text-lg sm:text-xl font-bold tracking-tight font-[family-name:var(--font-display)]"
          style={{ color: textColor }}
        >
          {tier.name}
        </h2>

        {/* Price section */}
        <div className="mt-3 mb-4">
          {tier.price_prefix && (
            <span
              className="block text-[10px] font-semibold uppercase tracking-widest mb-0.5"
              style={{ color: muted }}
            >
              {tier.price_prefix}
            </span>
          )}
          <div className="flex items-baseline gap-0.5">
            <span
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: tierAccent }}
            >
              {formatPrice(tier.price)}
            </span>
            {tier.price_suffix && (
              <span
                className="text-sm sm:text-base font-semibold"
                style={{ color: tierAccent }}
              >
                {tier.price_suffix}
              </span>
            )}
          </div>
        </div>

        {/* Conditions (e.g. "+ 15% Ad Spend...", "Excludes Ad Spend*") */}
        {tier.conditions.length > 0 && (
          <div className="mb-4 space-y-0.5">
            {tier.conditions.map((condition, idx) => (
              <p
                key={idx}
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: textColor }}
              >
                {condition}
              </p>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="mb-4" style={{ borderBottom: `1px solid ${border}` }} />

        {/* Features list */}
        <div className="flex-1 space-y-2.5">
          {tier.features.map((feature, idx) => (
            <FeatureItem
              key={idx}
              feature={feature}
              textColor={textColor}
              muted={muted}
              faint={faint}
              accent={tierAccent}
              surface={surface}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature Item (supports bold prefix + nested children) ──────── */

interface FeatureItemProps {
  feature: PackageFeature;
  textColor: string;
  muted: string;
  faint: string;
  accent: string;
  surface: string;
}

function FeatureItem({ feature, textColor, muted, faint, accent, surface }: FeatureItemProps) {
  const hasChildren = feature.children.length > 0;

  return (
    <div>
      {/* Main feature */}
      <div className="flex items-start gap-2.5">
        {/* Bullet dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
          style={{ backgroundColor: accent }}
        />
        <span className="text-sm leading-relaxed" style={{ color: textColor }}>
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

      {/* Nested children */}
      {hasChildren && (
        <div className="ml-4 mt-1.5 space-y-1.5">
          {feature.children.map((child, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <span
                className="w-1 h-1 rounded-full shrink-0 mt-[8px]"
                style={{ backgroundColor: faint }}
              />
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