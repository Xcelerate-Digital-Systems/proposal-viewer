// app/company/page.tsx
'use client';

import { Building2, Check, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomDomainManager from '@/components/admin/CustomDomainManager';
import { isValidHex6 } from '@/lib/company-utils';
import { useCompanySettings } from '@/components/admin/company/useCompanySettings';
import CompanyProfileCard from '@/components/admin/company/CompanyProfileCard';
import ViewerPreview from '@/components/admin/company/ViewerPreview';
import ViewerColorsSection from '@/components/admin/company/ViewerColorsSection';
import ViewerFontsSection from '@/components/admin/company/ViewerFontsSection';
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
          <h1 className="text-xl font-semibold text-ink">Company Settings</h1>
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
          onSaveField={s.handleSaveField}
          logoUploading={s.logoUploading}
          fileInputRef={s.fileInputRef}
          onLogoUpload={s.handleLogoUpload}
          onLogoRemove={s.handleLogoRemove}
        />

        {/* Custom Domain */}
        <CustomDomainManager companyId={companyId} isOwner={s.isOwner} />

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
          onSave={s.handleSaveColors}
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

        {/* Viewer Fonts */}
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

        {!s.isOwner && (
          <div className="bg-surface border border-edge rounded-[14px] p-4 text-center">
            <p className="text-sm text-faint">Only the company owner can edit these settings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
