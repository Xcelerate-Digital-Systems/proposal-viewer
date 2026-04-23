// components/admin/company/CompanyProfileCard.tsx
'use client';

import { RefObject } from 'react';
import { Building2, Upload, Trash2, Loader2, Globe, Link2, Check } from 'lucide-react';
import type { CompanyData } from '@/lib/company-utils';

interface CompanyProfileCardProps {
  company: CompanyData | null;
  isOwner: boolean;
  saving: string | null;
  // Profile fields
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  profileChanged: boolean;
  profileSaved: boolean;
  // Logo
  logoUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
}

export default function CompanyProfileCard({
  company, isOwner, saving,
  name, setName, slug, setSlug, website, setWebsite,
  profileChanged, profileSaved,
  logoUploading, fileInputRef, onLogoUpload, onLogoRemove,
}: CompanyProfileCardProps) {
  const isSavingProfile = saving === 'name' || saving === 'slug' || saving === 'website';
  return (
    <div className="bg-white border border-edge rounded-[14px] p-5 ">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-faint" />
          <span className="text-sm font-medium text-muted">Company Profile</span>
        </div>
        {isOwner && isSavingProfile && (
          <span className="flex items-center gap-1.5 text-xs text-faint">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {isOwner && !profileChanged && profileSaved && !isSavingProfile && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <p className="text-xs text-faint mb-5">Changes save automatically.</p>

      <div className="flex items-start gap-6 mb-5">
        {/* Logo */}
        <div className="w-20 h-20 bg-surface border border-edge rounded-[14px] flex items-center justify-center overflow-hidden shrink-0">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
          ) : (
            <Building2 size={28} className="text-edge-hover" />
          )}
        </div>
        {isOwner && (
          <div className="space-y-2 pt-1">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-edge text-sm text-muted rounded-lg hover:bg-edge disabled:opacity-50 transition-colors"
            >
              {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload Logo
            </button>
            {company?.logo_url && (
              <button onClick={onLogoRemove} disabled={logoUploading} className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:text-red-600 transition-colors">
                <Trash2 size={14} /> Remove
              </button>
            )}
            <p className="text-xs text-faint">PNG, JPEG, SVG, or WebP. Max 2MB.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">Company Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>

        {/* URL Slug */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link2 size={14} className="text-faint" />
            <label className="text-sm font-medium text-muted">URL Slug</label>
          </div>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 disabled:opacity-50 disabled:cursor-not-allowed" />
          <p className="text-xs text-faint mt-1">Lowercase letters, numbers, and hyphens only. Minimum 2 characters.</p>
        </div>

        {/* Website */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Globe size={14} className="text-faint" />
            <label className="text-sm font-medium text-muted">Website</label>
          </div>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourcompany.com" disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>
      </div>
    </div>
  );
}
