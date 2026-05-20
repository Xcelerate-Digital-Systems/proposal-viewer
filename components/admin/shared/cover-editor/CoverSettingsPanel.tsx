// components/admin/shared/cover-editor/CoverSettingsPanel.tsx
'use client';

import { useRef } from 'react';
import { Trash2, Image, Eye, EyeOff, Palette, User, Calendar, Building2, Type } from 'lucide-react';
import CoverColorControls, { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
import ColorPickerField from '@/components/ui/ColorPickerField';
import { EntityType, EntityConfig } from './CoverEditorTypes';

/* ── Reusable toggle row ─────────────────────────────────────────── */

function ToggleRow({
  icon,
  label,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-teal' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-[1px] w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-[1px]'}`} />
      </button>
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────── */

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {icon}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Props ────────────────────────────────────────────────────────── */

interface CoverSettingsPanelProps {
  type: EntityType;
  cfg: EntityConfig;
  /** Hide the Cover Colors section (used on the Quote cover tab where colours
   *  live on the Settings tab instead, and on the new content-only Cover tab
   *  where colours live on the Design tab). */
  hideColors?: boolean;
  /** Hide the Cover Enabled toggle (quote covers always show). */
  hideEnableToggle?: boolean;
  /** Hide the Background Image section. Used on the content-only Cover tab
   *  where the background image moves to the Design tab. */
  hideImage?: boolean;
  companyId: string;
  clientName?: string;
  /* Enable/disable */
  coverEnabled: boolean;
  setCoverEnabled: (v: boolean) => void;
  /* Subtitle */
  subtitle: string;
  setSubtitle: (v: string) => void;
  subtitlePlaceholder: string;
  /* Prepared by */
  preparedByMemberId: string | null;
  setPreparedByMemberId: (v: string | null) => void;
  showPreparedBy: boolean;
  setShowPreparedBy: (v: boolean) => void;
  showAvatar: boolean;
  setShowAvatar: (v: boolean) => void;
  /* Date */
  coverDate: string;
  setCoverDate: (v: string) => void;
  showDate: boolean;
  setShowDate: (v: boolean) => void;
  /* Client logo */
  showClientLogo: boolean;
  setShowClientLogo: (v: boolean) => void;
  clientLogoUrl: string | null;
  clientLogoPath: string;
  /** When set, the logo is rendered as a flat silhouette in this colour (CSS mask).
   *  Null leaves the logo in its original colours. */
  clientLogoTintColor: string | null;
  setClientLogoTintColor: (v: string | null) => void;
  uploadingClientLogo: boolean;
  onClientLogoUpload: (file: File) => void;
  onClientLogoRemove: () => void;
  /* Accept button (proposals only) */
  acceptButtonText: string;
  setAcceptButtonText: (v: string) => void;
  /* Background image */
  imageUrl: string | null;
  imagePath: string;
  uploading: boolean;
  onImageUpload: (file: File) => void;
  onImageRemove: () => void;
  /* Cover colors */
  colors: CoverColorValues;
  onColorsChange: (partial: Partial<CoverColorValues>) => void;
}

export default function CoverSettingsPanel({
  type,
  cfg,
  hideColors,
  hideEnableToggle,
  hideImage,
  companyId,
  clientName,
  coverEnabled,
  setCoverEnabled,
  subtitle,
  setSubtitle,
  subtitlePlaceholder,
  preparedByMemberId,
  setPreparedByMemberId,
  showPreparedBy,
  setShowPreparedBy,
  showAvatar,
  setShowAvatar,
  coverDate,
  setCoverDate,
  showDate,
  setShowDate,
  showClientLogo,
  setShowClientLogo,
  clientLogoUrl,
  clientLogoPath,
  clientLogoTintColor,
  setClientLogoTintColor,
  uploadingClientLogo,
  onClientLogoUpload,
  onClientLogoRemove,
  acceptButtonText,
  setAcceptButtonText,
  imageUrl,
  imagePath,
  uploading,
  onImageUpload,
  onImageRemove,
  colors,
  onColorsChange,
}: CoverSettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const clientLogoRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      {/* ── Enable/disable toggle ────────────────────────── */}
      {!hideEnableToggle && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {coverEnabled ? <Eye size={16} className="text-teal" /> : <EyeOff size={16} className="text-gray-400" />}
              <span className="text-sm text-gray-900 font-medium">Cover Page</span>
            </div>
            <button
              onClick={() => setCoverEnabled(!coverEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${coverEnabled ? 'bg-teal' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${coverEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* ── Subtitle ─────────────────────────────────────── */}
      {cfg.fields.subtitle && (
        <>
          <div className="space-y-2">
            <SectionHeader icon={<Type size={14} className="text-gray-400" />} label={cfg.labels.subtitle} />
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={subtitlePlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-gray-400"
            />
            {cfg.labels.subtitleHint && (
              <p className="text-xs text-gray-400">{cfg.labels.subtitleHint}</p>
            )}
            {type === 'proposal' && clientName && !cfg.labels.subtitleHint && (
              <p className="text-xs text-gray-400">Leave blank for &quot;Prepared for {clientName}&quot;</p>
            )}
          </div>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* ── Prepared By ──────────────────────────────────── */}
      {cfg.fields.preparedBy && (
        <>
          <div className="space-y-3">
            <SectionHeader icon={<User size={14} className="text-gray-400" />} label="Prepared By" />
            <PreparedBySelector
              companyId={companyId}
              selectedMemberId={preparedByMemberId}
              onSelect={(id) => setPreparedByMemberId(id)}
            />
            <p className="text-xs text-gray-400">
              {type === 'template'
                ? 'Default author for proposals created from this template.'
                : 'Select who prepared this proposal. Their name and photo come from their profile.'}
            </p>
            <ToggleRow
              icon={<User size={14} className="text-gray-400" />}
              label="Show prepared by"
              enabled={showPreparedBy}
              onToggle={() => setShowPreparedBy(!showPreparedBy)}
            />
            {cfg.fields.avatar && (
              <ToggleRow
                icon={<User size={14} className="text-gray-400" />}
                label="Show avatar"
                enabled={showAvatar}
                onToggle={() => setShowAvatar(!showAvatar)}
              />
            )}
          </div>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* ── Date ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader icon={<Calendar size={14} className="text-gray-400" />} label="Date" />
        <ToggleRow
          icon={<Calendar size={14} className="text-gray-400" />}
          label="Show date"
          enabled={showDate}
          onToggle={() => setShowDate(!showDate)}
        />
        {showDate && (
          <div>
            <input
              type="text"
              value={coverDate}
              onChange={(e) => setCoverDate(e.target.value)}
              placeholder="e.g. Feb 2026"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Free-text date shown on the cover page</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Client Logo ──────────────────────────────────── */}
      {cfg.fields.clientLogo && (
        <>
          <div className="space-y-3">
            <SectionHeader icon={<Building2 size={14} className="text-gray-400" />} label="Client Logo" />
            <ToggleRow
              icon={<Building2 size={14} className="text-gray-400" />}
              label="Show client logo"
              enabled={showClientLogo}
              onToggle={() => setShowClientLogo(!showClientLogo)}
            />
            {showClientLogo && (
              <div className="space-y-3">
                {clientLogoUrl ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                    {clientLogoTintColor ? (
                      // Tinted preview: render the logo as a CSS mask so any colour shows through.
                      // Loses internal colour detail (turns into a flat silhouette) — by design.
                      <div
                        className="h-8 w-[120px] shrink-0"
                        style={{
                          backgroundColor: clientLogoTintColor,
                          WebkitMaskImage: `url("${clientLogoUrl}")`,
                          maskImage: `url("${clientLogoUrl}")`,
                          WebkitMaskRepeat: 'no-repeat',
                          maskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'left center',
                          maskPosition: 'left center',
                          WebkitMaskSize: 'contain',
                          maskSize: 'contain',
                        }}
                        aria-label="Tinted client logo preview"
                      />
                    ) : (
                      <img src={clientLogoUrl} alt="" className="h-8 max-w-[120px] object-contain" />
                    )}
                    <span className="text-xs text-gray-500 flex-1 truncate">{clientLogoPath.split('/').pop()}</span>
                    <button onClick={onClientLogoRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => clientLogoRef.current?.click()}
                    disabled={uploadingClientLogo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal/30 hover:text-teal transition-colors disabled:opacity-50"
                  >
                    <Image size={16} />
                    {uploadingClientLogo ? 'Uploading...' : 'Upload client logo'}
                  </button>
                )}
                <input
                  ref={clientLogoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onClientLogoUpload(f);
                  }}
                />
                {clientLogoUrl && (
                  <ColorPickerField
                    label="Recolor logo"
                    hint="Flattens the logo to a single colour. Leave unset to keep the original."
                    value={clientLogoTintColor}
                    fallback="#ffffff"
                    onChange={(v) => setClientLogoTintColor(v)}
                    onReset={() => setClientLogoTintColor(null)}
                  />
                )}
              </div>
            )}
          </div>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* ── Accept Button Text (proposals only) ──────────── */}
      {cfg.fields.acceptButtonText && (
        <>
          <div className="space-y-2">
            <SectionHeader icon={<Type size={14} className="text-gray-400" />} label="Accept Button Text" />
            <input
              type="text"
              value={acceptButtonText}
              onChange={(e) => setAcceptButtonText(e.target.value)}
              placeholder="ACCEPT PROPOSAL"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-400">Leave blank for default.</p>
          </div>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* ── Background Image ─────────────────────────────── */}
      {!hideImage && (
      <div className="space-y-3">
        <SectionHeader icon={<Image size={14} className="text-gray-400" />} label="Background Image" />
        {imageUrl ? (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
            <img src={imageUrl} alt="" className="h-10 w-14 object-cover rounded" />
            <span className="text-xs text-gray-500 flex-1 truncate">{imagePath.split('/').pop()}</span>
            <button onClick={onImageRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal/30 hover:text-teal transition-colors disabled:opacity-50"
          >
            <Image size={16} />
            {uploading ? 'Uploading...' : 'Upload background image'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImageUpload(f);
            e.target.value = '';
          }}
        />
      </div>
      )}

      {!hideColors && (
        <>
          <div className="border-t border-gray-100" />

          {/* ── Cover Colors ─────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeader icon={<Palette size={14} className="text-gray-400" />} label="Cover Colors" />
            <CoverColorControls
              {...colors}
              onChange={onColorsChange}
            />
          </div>
        </>
      )}
    </div>
  );
}