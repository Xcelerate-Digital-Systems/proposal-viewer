// components/admin/company/ViewerFontsSection.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Check, Loader2, Type, X, ChevronDown } from 'lucide-react';
import { GOOGLE_FONTS, WEIGHT_OPTIONS, getAvailableWeights, buildGoogleFontsUrl, fontFamily } from '@/lib/google-fonts';

interface ViewerFontsSectionProps {
  isOwner: boolean;
  saving: string | null;
  fontsChanged: boolean;
  fontHeading: string | null;
  setFontHeading: (v: string | null) => void;
  fontBody: string | null;
  setFontBody: (v: string | null) => void;
  fontSidebar: string | null;
  setFontSidebar: (v: string | null) => void;
  fontHeadingWeight: string | null;
  setFontHeadingWeight: (v: string | null) => void;
  fontBodyWeight: string | null;
  setFontBodyWeight: (v: string | null) => void;
  fontSidebarWeight: string | null;
  setFontSidebarWeight: (v: string | null) => void;
  onSave: () => void;
  lastSaved?: boolean;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'sans-serif', label: 'Sans Serif' },
  { key: 'serif', label: 'Serif' },
  { key: 'display', label: 'Display' },
  { key: 'monospace', label: 'Mono' },
] as const;

function WeightPicker({
  font,
  value,
  onChange,
  disabled,
}: {
  font: string | null;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled: boolean;
}) {
  const available = getAvailableWeights(font);
  const options = WEIGHT_OPTIONS.filter((w) => available.includes(w.value));

  // If only 1 weight available or no font selected, don't show picker
  if (!font || options.length <= 1) return null;

  const current = value || '400';

  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value === '400' ? null : e.target.value)}
        disabled={disabled}
        className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{ fontWeight: Number(current) }}
      >
        {options.map((w) => (
          <option key={w.value} value={w.value} style={{ fontWeight: Number(w.value) }}>
            {w.label} ({w.value})
          </option>
        ))}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function FontSelect({
  label,
  description,
  value,
  onChange,
  disabled,
  previewText,
  weight,
  onWeightChange,
}: {
  label: string;
  description: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled: boolean;
  previewText: string;
  weight: string | null;
  onWeightChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    return GOOGLE_FONTS.filter((f) => {
      if (category !== 'all' && f.category !== category) return false;
      if (search && !f.family.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, category]);

  // Load preview fonts when dropdown is open
  useEffect(() => {
    if (!open) return;
    const url = buildGoogleFontsUrl(filtered.slice(0, 20).map((f) => f.family));
    if (!url) return;
    const existing = document.querySelector(`link[data-font-preview]`);
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-font-preview', 'true');
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [open, filtered]);

  // Also load the currently selected font for the preview
  useEffect(() => {
    if (!value) return;
    const url = buildGoogleFontsUrl([value]);
    if (!url) return;
    const id = `font-selected-${value.replace(/ /g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.id = id;
    document.head.appendChild(link);
  }, [value]);

  const effectiveWeight = weight || '400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <WeightPicker
          font={value}
          value={weight}
          onChange={onWeightChange}
          disabled={disabled}
        />
      </div>

      {/* Current value display / trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-left hover:border-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={value ? 'text-gray-900' : 'text-gray-400'}
            style={value ? { fontFamily: fontFamily(value, 'sans-serif'), fontWeight: Number(effectiveWeight) } : undefined}
          >
            {value || 'System default'}
          </span>
          {value ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); onWeightChange(null); }}
              className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          ) : (
            <Type size={14} className="text-gray-300" />
          )}
        </button>

        {/* Preview of selected font */}
        {value && (
          <div
            className="mt-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-lg"
            style={{ fontFamily: fontFamily(value, 'sans-serif'), fontWeight: Number(effectiveWeight) }}
          >
            {previewText}
          </div>
        )}

        {/* Dropdown */}
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-[340px] flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search fonts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
                  autoFocus
                />
                {/* Category tabs */}
                <div className="flex gap-1 mt-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(cat.key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        category === cat.key
                          ? 'bg-[#017C87] text-white'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font list */}
              <div className="overflow-y-auto flex-1">
                {/* System default option */}
                <button
                  type="button"
                  onClick={() => { onChange(null); onWeightChange(null); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    !value ? 'bg-[#017C87]/5 text-[#017C87] font-medium' : 'text-gray-500'
                  }`}
                >
                  System default
                </button>

                {filtered.map((font) => (
                  <button
                    key={font.family}
                    type="button"
                    onClick={() => { onChange(font.family); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      value === font.family ? 'bg-[#017C87]/5' : ''
                    }`}
                  >
                    <span
                      className="text-sm text-gray-900"
                      style={{ fontFamily: `'${font.family}', ${font.category}` }}
                    >
                      {font.family}
                    </span>
                    <span className="text-[10px] text-gray-300 uppercase tracking-wider">
                      {font.category}
                    </span>
                  </button>
                ))}

                {filtered.length === 0 && (
                  <div className="px-4 py-6 text-sm text-gray-400 text-center">
                    No fonts match your search
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ViewerFontsSection({
  isOwner,
  saving,
  fontsChanged,
  fontHeading,
  setFontHeading,
  fontBody,
  setFontBody,
  fontSidebar,
  setFontSidebar,
  fontHeadingWeight,
  setFontHeadingWeight,
  fontBodyWeight,
  setFontBodyWeight,
  fontSidebarWeight,
  setFontSidebarWeight,
  onSave,
  lastSaved,
}: ViewerFontsSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Type size={15} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Viewer Fonts</span>
        </div>
        {/* Autosave status */}
        {isOwner && saving === 'fonts' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {isOwner && !fontsChanged && lastSaved && saving !== 'fonts' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Choose Google Fonts and weights for your proposal viewer. Changes save automatically.
      </p>

      <div className="space-y-5">
        <FontSelect
          label="Heading Font"
          description="Cover page title & section headings"
          value={fontHeading}
          onChange={setFontHeading}
          disabled={!isOwner}
          previewText="Your Proposal Title"
          weight={fontHeadingWeight}
          onWeightChange={setFontHeadingWeight}
        />

        <FontSelect
          label="Body Font"
          description="Cover subtitle & general text"
          value={fontBody}
          onChange={setFontBody}
          disabled={!isOwner}
          previewText="Prepared for your client"
          weight={fontBodyWeight}
          onWeightChange={setFontBodyWeight}
        />

        <FontSelect
          label="Sidebar Font"
          description="Navigation items in the sidebar"
          value={fontSidebar}
          onChange={setFontSidebar}
          disabled={!isOwner}
          previewText="Executive Summary"
          weight={fontSidebarWeight}
          onWeightChange={setFontSidebarWeight}
        />
      </div>
    </div>
  );
}