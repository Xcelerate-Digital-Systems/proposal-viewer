// app/company/page.tsx
'use client';

import { useRef } from 'react';
import { Building2, Check, Loader2, ImageIcon, Upload, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomDomainManager from '@/components/admin/CustomDomainManager';
import { isValidHex6 } from '@/lib/company-utils';
import { useCompanySettings } from '@/components/admin/company/useCompanySettings';
import ViewerPreview from '@/components/admin/company/ViewerPreview';
import ViewerColorsSection from '@/components/admin/company/ViewerColorsSection';
import ViewerFontsSection from '@/components/admin/company/ViewerFontsSection';
import BrandColorsSection from '@/components/admin/company/BrandColorsSection';
import ContentPageDefaultsSection from '@/components/admin/company/ContentPageDefaultsSection';
import DecisionDesignSection from '@/components/admin/company/DecisionDesignSection';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import { buildGradientCss, resolveStops } from '@/lib/gradient-stops';

export default function CompanySettingsPage() {
  return (
    <AdminLayout>
      {(auth) => <CompanySettingsContent companyId={auth.companyId ?? ''} />}
    </AdminLayout>
  );
}

function CompanySettingsContent({ companyId }: { companyId: string }) {
  const s = useCompanySettings(companyId);

  if (s.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-faint" />
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-10 py-8">
      <GoogleFontLoader fonts={[s.fontHeading, s.fontBody, s.fontSidebar]} />

      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-teal-tint rounded-2xl flex items-center justify-center">
          <Building2 size={20} className="text-teal" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">Brand Kit</h1>
          <p className="text-sm text-muted">
            {s.isOwner ? 'Colours, fonts, and default cover image' : 'View company branding'}
          </p>
        </div>
      </div>

      {/* Feedback */}
      {s.error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 px-4 py-2.5 rounded-[10px]">{s.error}</div>
      )}
      {s.success && (
        <div className="mb-4 text-xs text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-[10px] flex items-center gap-1.5">
          <Check size={12} /> {s.success}
        </div>
      )}

      <div className="space-y-5">

        {/* Brand Colors + Fonts — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <BrandColorsSection
            isOwner={s.isOwner}
            saving={s.saving}
            brandColors={s.brandColors}
            setBrandColors={s.setBrandColors}
            lastSaved={s.brandColorsSaved}
            saveError={s.brandColorsError}
          />

          <ViewerFontsSection
            isOwner={s.isOwner}
            saving={s.saving}
            fontsChanged={s.fontsChanged}
            fontHeading={s.fontHeading}
            setFontHeading={s.setFontHeading}
            fontBody={s.fontBody}
            setFontBody={s.setFontBody}
            fontSidebar={s.fontSidebar}
            setFontSidebar={s.setFontSidebar}
            fontHeadingWeight={s.fontHeadingWeight}
            setFontHeadingWeight={s.setFontHeadingWeight}
            fontBodyWeight={s.fontBodyWeight}
            setFontBodyWeight={s.setFontBodyWeight}
            fontSidebarWeight={s.fontSidebarWeight}
            setFontSidebarWeight={s.setFontSidebarWeight}
            onSave={s.handleSaveFonts}
            lastSaved={s.fontsSaved}
          />
        </div>

        {/* Viewer Colors */}
        <ViewerColorsSection
          isOwner={s.isOwner}
          saving={s.saving}
          colorsChanged={s.colorsChanged}
          accentColor={s.accentColor}
          setAccentColor={s.setAccentColor}
          bgPrimary={s.bgPrimary}
          setBgPrimary={s.setBgPrimary}
          bgSecondary={s.bgSecondary}
          setBgSecondary={s.setBgSecondary}
          bgDivider={s.bgDivider}
          setBgDivider={s.setBgDivider}
          sidebarTextColor={s.sidebarTextColor}
          setSidebarTextColor={s.setSidebarTextColor}
          acceptTextColor={s.acceptTextColor}
          setAcceptTextColor={s.setAcceptTextColor}
          lastSaved={s.colorsSaved}
          bgImageUrl={s.bgImageUrl}
          bgImageUploading={s.bgImageUploading}
          bgImageOverlayOpacity={s.bgImageOverlayOpacity}
          setBgImageOverlayOpacity={s.setBgImageOverlayOpacity}
          onBgImageUpload={s.handleBgImageUpload}
          onBgImageRemove={s.handleBgImageRemove}
        >
          <p className="text-xs text-faint mb-3">Preview how your brand colours apply across client-facing surfaces.</p>
          <ViewerPreview
            accent={isValidHex6(s.accentColor) ? s.accentColor : '#01434A'}
            bgPrimary={isValidHex6(s.bgPrimary) ? s.bgPrimary : '#0f0f0f'}
            bgSecondary={isValidHex6(s.bgSecondary) ? s.bgSecondary : '#141414'}
            bgDivider={s.bgDivider}
            sidebarTextColor={isValidHex6(s.sidebarTextColor) ? s.sidebarTextColor : '#ffffff'}
            acceptTextColor={isValidHex6(s.acceptTextColor) ? s.acceptTextColor : '#ffffff'}
            logoUrl={s.company?.logo_url || null}
            companyName={s.name}
            fontSidebar={s.fontSidebar}
            fontSidebarWeight={s.fontSidebarWeight}
            bgImageUrl={s.bgImageUrl}
            bgImageOverlayOpacity={s.bgImageOverlayOpacity}
          />
        </ViewerColorsSection>

        {/* Content Page Defaults */}
        <ContentPageDefaultsSection
          isOwner={s.isOwner}
          saving={s.saving}
          contentPageChanged={s.contentPageChanged}
          textPageBgColor={s.textPageBgColor}
          setTextPageBgColor={s.setTextPageBgColor}
          textPageTextColor={s.textPageTextColor}
          setTextPageTextColor={s.setTextPageTextColor}
          textPageHeadingColor={s.textPageHeadingColor}
          setTextPageHeadingColor={s.setTextPageHeadingColor}
          lastSaved={s.contentPageSaved}
        />

        {/* Decision Design */}
        <DecisionDesignSection
          isOwner={s.isOwner}
          saving={s.saving}
          lastSaved={s.decisionDesignSaved}
          decisionBgColor={s.decisionBgColor}
          setDecisionBgColor={s.setDecisionBgColor}
          decisionTextColor={s.decisionTextColor}
          setDecisionTextColor={s.setDecisionTextColor}
          decisionHeadingColor={s.decisionHeadingColor}
          setDecisionHeadingColor={s.setDecisionHeadingColor}
          decisionAcceptButtonColor={s.decisionAcceptButtonColor}
          setDecisionAcceptButtonColor={s.setDecisionAcceptButtonColor}
          decisionDeclineButtonColor={s.decisionDeclineButtonColor}
          setDecisionDeclineButtonColor={s.setDecisionDeclineButtonColor}
          decisionRevisionButtonColor={s.decisionRevisionButtonColor}
          setDecisionRevisionButtonColor={s.setDecisionRevisionButtonColor}
          decisionCheckboxColor={s.decisionCheckboxColor}
          setDecisionCheckboxColor={s.setDecisionCheckboxColor}
          textPageBgColor={s.textPageBgColor}
          textPageTextColor={s.textPageTextColor}
          textPageHeadingColor={s.textPageHeadingColor}
          accentColor={s.accentColor}
        />

        {/* Default Cover Image */}
        <CoverImageSection
          isOwner={s.isOwner}
          coverImageUrl={s.coverImageUrl}
          coverImageUploading={s.coverImageUploading}
          onUpload={s.handleCoverImageUpload}
          onRemove={s.handleCoverImageRemove}
          company={s.company}
          logoUrl={s.company?.logo_url || null}
          companyName={s.name}
          fontHeading={s.fontHeading}
          fontBody={s.fontBody}
          fontHeadingWeight={s.fontHeadingWeight}
          fontBodyWeight={s.fontBodyWeight}
        />

        {/* Custom Domain */}
        <CustomDomainManager companyId={companyId} isOwner={s.isOwner} />

        {!s.isOwner && (
          <div className="bg-surface border border-edge rounded-[14px] p-4 text-center">
            <p className="text-sm text-faint">Only the company owner can edit these settings.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Cover Image Section with live preview ───────────────────────── */

import { hexToRgba } from '@/lib/branding/color-math';

function CoverImageSection({
  isOwner,
  coverImageUrl,
  coverImageUploading,
  onUpload,
  onRemove,
  company,
  logoUrl,
  companyName,
  fontHeading,
  fontBody,
  fontHeadingWeight,
  fontBodyWeight,
}: {
  isOwner: boolean;
  coverImageUrl: string | null;
  coverImageUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  company: import('@/lib/company-utils').CompanyData | null;
  logoUrl: string | null;
  companyName: string;
  fontHeading: string | null;
  fontBody: string | null;
  fontHeadingWeight: string | null;
  fontBodyWeight: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const bgColor1 = company?.cover_bg_color_1 || '#0f0f0f';
  const bgColor2 = company?.cover_bg_color_2 || '#141414';
  const bgStyle = company?.cover_bg_style || 'gradient';
  const textColor = company?.cover_text_color || '#ffffff';
  const subtitleColor = company?.cover_subtitle_color || '#ffffffb3';
  const btnBg = company?.cover_button_bg || '#01434A';
  const btnText = company?.cover_button_text || '#ffffff';
  const overlayOpacity = company?.cover_overlay_opacity ?? 0.65;
  const gradientType = (company?.cover_gradient_type || 'linear') as 'linear' | 'radial' | 'conic';
  const gradientAngle = company?.cover_gradient_angle ?? 135;
  const gradientStops = resolveStops(null, bgColor1, bgColor2);

  const baseBg = bgStyle === 'solid' ? bgColor1 : undefined;
  const baseBgImage = bgStyle === 'gradient'
    ? buildGradientCss('gradient', gradientType, gradientAngle, 50, 50, gradientStops)
    : undefined;

  const imageOverlay = overlayOpacity <= 0
    ? undefined
    : bgStyle === 'solid'
      ? hexToRgba(bgColor1, overlayOpacity)
      : buildGradientCss(
          'gradient',
          gradientType,
          gradientAngle,
          50,
          50,
          gradientStops.map((s) => ({ ...s, color: hexToRgba(s.color, overlayOpacity) })),
        );

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon size={15} className="text-faint" />
        <span className="text-sm font-medium text-muted">Default Cover Image</span>
      </div>
      <p className="text-xs text-faint mb-4">
        Upload a default background image for the cover page. New proposals and quotes will use this automatically. You can still override it per-proposal.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: upload controls */}
        <div>
          {coverImageUrl ? (
            <div className="flex items-start gap-4">
              <div
                className="w-32 h-20 rounded-lg border border-edge bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${coverImageUrl})` }}
              />
              <div className="space-y-1.5">
                {isOwner && (
                  <>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={coverImageUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted bg-surface border border-edge rounded-lg hover:bg-edge disabled:opacity-50 transition-colors"
                    >
                      {coverImageUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Replace
                    </button>
                    <button
                      onClick={onRemove}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            isOwner && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={coverImageUploading}
                className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-edge text-faint hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
              >
                {coverImageUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                <span className="text-xs font-medium">Upload cover image</span>
              </button>
            )
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Right: live cover page preview */}
        <div>
          <p className="text-xs text-faint mb-2">Preview</p>
          <div
            className="rounded-2xl overflow-hidden border border-edge shadow-lg aspect-[16/10] relative"
            style={{ backgroundColor: bgColor1 }}
          >
            {/* Background layer */}
            {coverImageUrl ? (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverImageUrl})` }}
                />
                {imageOverlay && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: imageOverlay.includes('-gradient(') ? imageOverlay : undefined,
                      backgroundColor: !imageOverlay.includes('-gradient(') ? imageOverlay : undefined,
                    }}
                  />
                )}
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: baseBg,
                  backgroundImage: baseBgImage,
                }}
              />
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full p-4 sm:p-5">
              {/* Logo */}
              <div>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={companyName}
                    className="h-4 sm:h-5 max-w-[100px] object-contain object-left"
                  />
                ) : companyName ? (
                  <div className="flex items-center gap-1.5">
                    <Building2 size={10} style={{ color: subtitleColor }} />
                    <span
                      className="text-2xs font-medium"
                      style={{ color: textColor, fontFamily: fontFamily(fontHeading) }}
                    >
                      {companyName}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex-1" />

              {/* Title + subtitle + button */}
              <div className="max-w-[75%]">
                <h2
                  className="text-sm sm:text-base font-semibold leading-tight mb-1"
                  style={{
                    color: textColor,
                    fontFamily: fontFamily(fontHeading),
                    fontWeight: fontHeadingWeight ? Number(fontHeadingWeight) : undefined,
                  }}
                >
                  Website Redesign Proposal
                </h2>
                <p
                  className="text-2xs sm:text-xs mb-0.5"
                  style={{ color: subtitleColor, fontFamily: fontFamily(fontBody) }}
                >
                  Prepared for Acme Corporation
                </p>
                <p
                  className="text-2xs"
                  style={{
                    color: subtitleColor,
                    opacity: 0.8,
                    fontFamily: fontFamily(fontBody),
                    fontWeight: fontBodyWeight ? Number(fontBodyWeight) : undefined,
                  }}
                >
                  Prepared by Jane Smith
                </p>
                <div className="mt-2.5">
                  <div
                    className="inline-flex px-3 py-1 rounded text-2xs tracking-wider uppercase font-semibold"
                    style={{
                      backgroundColor: btnBg,
                      color: btnText,
                      fontFamily: fontFamily(fontHeading),
                    }}
                  >
                    Start Reading
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
