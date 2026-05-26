// app/company/page.tsx
'use client';

import { useRef } from 'react';
import { Building2, Check, Loader2, ImageIcon, Upload, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomDomainManager from '@/components/admin/CustomDomainManager';
import { isValidHex6 } from '@/lib/company-utils';
import { useCompanySettings } from '@/components/admin/company/useCompanySettings';
import CompanyProfileCard from '@/components/admin/company/CompanyProfileCard';
import BusinessDetailsCard from '@/components/admin/company/BusinessDetailsCard';
import ViewerPreview from '@/components/admin/company/ViewerPreview';
import ViewerColorsSection from '@/components/admin/company/ViewerColorsSection';
import ViewerFontsSection from '@/components/admin/company/ViewerFontsSection';
import BrandColorsSection from '@/components/admin/company/BrandColorsSection';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

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
        <div className="w-10 h-10 bg-teal-tint rounded-xl flex items-center justify-center">
          <Building2 size={20} className="text-teal" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">Brand Kit</h1>
          <p className="text-sm text-muted">
            {s.isOwner ? 'Manage your company profile and branding' : 'View company profile'}
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

        {/* Business Details — phone, email, ABN, address, quote-number format */}
        <BusinessDetailsCard companyId={companyId} isOwner={s.isOwner} />

        {/* Company Profile */}
        <CompanyProfileCard
          company={s.company}
          isOwner={s.isOwner}
          saving={s.saving}
          name={s.name}
          setName={s.setName}
          slug={s.slug}
          setSlug={s.setSlug}
          website={s.website}
          setWebsite={s.setWebsite}
          profileChanged={s.profileChanged}
          profileSaved={s.profileSaved}
          logoUploading={s.logoUploading}
          fileInputRef={s.fileInputRef}
          onLogoUpload={s.handleLogoUpload}
          onLogoRemove={s.handleLogoRemove}
        />

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
          <p className="text-xs text-faint mb-3">This is how your proposals will appear to clients.</p>
          <ViewerPreview
            accent={isValidHex6(s.accentColor) ? s.accentColor : '#01434A'}
            bgPrimary={isValidHex6(s.bgPrimary) ? s.bgPrimary : '#0f0f0f'}
            bgSecondary={isValidHex6(s.bgSecondary) ? s.bgSecondary : '#141414'}
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

        {/* Default Cover Image */}
        <CoverImageSection
          isOwner={s.isOwner}
          coverImageUrl={s.coverImageUrl}
          coverImageUploading={s.coverImageUploading}
          onUpload={s.handleCoverImageUpload}
          onRemove={s.handleCoverImageRemove}
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

/* ── Cover Image Section ──────────────────────────────────────────── */

function CoverImageSection({
  isOwner,
  coverImageUrl,
  coverImageUploading,
  onUpload,
  onRemove,
}: {
  isOwner: boolean;
  coverImageUrl: string | null;
  coverImageUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon size={15} className="text-faint" />
        <span className="text-sm font-medium text-muted">Default Cover Image</span>
      </div>
      <p className="text-xs text-faint mb-4">
        Upload a default background image for the cover page. New proposals and quotes will use this automatically. You can still override it per-proposal.
      </p>

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
  );
}
