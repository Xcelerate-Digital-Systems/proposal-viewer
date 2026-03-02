// components/admin/shared/cover-editor/CoverSettingsPanel.tsx
'use client';

import { useRef } from 'react';
import { Trash2, Image, Eye, EyeOff, Palette, User, Calendar, Building2 } from 'lucide-react';
import CoverColorControls, { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
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
        className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-[1px] w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-[1px]'}`} />
      </button>
    </div>
  );
}

/* ── Props ────────────────────────────────────────────────────────── */

interface CoverSettingsPanelProps {
  type: EntityType;
  cfg: EntityConfig;
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
    <div className="space-y-4 lg:overflow-y-auto lg:pr-2">
      {/* Enable/disable toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200">
        <div className="flex items-center gap-2">
          {coverEnabled ? <Eye size={16} className="text-[#017C87]" /> : <EyeOff size={16} className="text-gray-400" />}
          <span className="text-sm text-gray-900 font-medium">Cover Page</span>
        </div>
        <button
          onClick={() => setCoverEnabled(!coverEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${coverEnabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${coverEnabled ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Subtitle */}
      {cfg.fields.subtitle && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{cfg.labels.subtitle}</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={subtitlePlaceholder}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
          />
          {cfg.labels.subtitleHint && (
            <p className="text-xs text-gray-400 mt-1">{cfg.labels.subtitleHint}</p>
          )}
          {type === 'proposal' && clientName && !cfg.labels.subtitleHint && (
            <p className="text-xs text-gray-400 mt-1">Leave blank for &quot;Prepared for {clientName}&quot;</p>
          )}
        </div>
      )}

      {/* ── Prepared By section ─────────────────────────── */}
      {cfg.fields.preparedBy && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <User size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Prepared By</span>
          </div>

          <div>
            <PreparedBySelector
              companyId={companyId}
              selectedMemberId={preparedByMemberId}
              onSelect={(id) => setPreparedByMemberId(id)}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {type === 'template'
                ? 'Default author for proposals created from this template.'
                : 'Select who prepared this proposal. Their name and photo come from their profile.'}
            </p>
          </div>

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
      )}

      {/* ── Date section ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Calendar size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Date</span>
        </div>
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
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Free-text date shown on the cover page</p>
          </div>
        )}
      </div>

      {/* ── Client Logo section ──────────────────────────── */}
      {cfg.fields.clientLogo && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Building2 size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Client Logo</span>
          </div>
          <ToggleRow
            icon={<Building2 size={14} className="text-gray-400" />}
            label="Show client logo"
            enabled={showClientLogo}
            onToggle={() => setShowClientLogo(!showClientLogo)}
          />
          {showClientLogo && (
            <div>
              {clientLogoUrl ? (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <img src={clientLogoUrl} alt="" className="h-8 max-w-[120px] object-contain" />
                  <span className="text-xs text-gray-500 flex-1 truncate">{clientLogoPath.split('/').pop()}</span>
                  <button onClick={onClientLogoRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => clientLogoRef.current?.click()}
                  disabled={uploadingClientLogo}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#017C87]/30 hover:text-[#017C87] transition-colors disabled:opacity-50"
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
            </div>
          )}
        </div>
      )}

      {/* Accept button text (proposals only) */}
      {cfg.fields.acceptButtonText && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Accept Button Text</label>
          <input
            type="text"
            value={acceptButtonText}
            onChange={(e) => setAcceptButtonText(e.target.value)}
            placeholder="ACCEPT PROPOSAL"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">Leave blank for default.</p>
        </div>
      )}

      {/* Background image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
        {imageUrl ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
            <img src={imageUrl} alt="" className="w-16 h-10 object-cover rounded" />
            <span className="text-sm text-gray-600 flex-1 truncate">{imagePath.split('/').pop()}</span>
            <button onClick={onImageRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#017C87]/30 hover:text-[#017C87] transition-colors disabled:opacity-50"
          >
            <Image size={16} />
            {uploading ? 'Uploading...' : 'Upload cover image'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImageUpload(f);
          }}
        />
      </div>

      {/* ── Cover Colors ────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-gray-100">
          <Palette size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Cover Colors</span>
        </div>
        <div className="p-3">
          <CoverColorControls {...colors} onChange={onColorsChange} />
        </div>
      </div>
    </div>
  );
}