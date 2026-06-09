// components/admin/company/ContentPageDefaultsSection.tsx
'use client';

import { ReactNode } from 'react';
import { Check, Loader2, FileText } from 'lucide-react';
import ColorPickerField from '@/components/ui/ColorPickerField';

interface ContentPageDefaultsSectionProps {
  isOwner: boolean;
  saving: string | null;
  contentPageChanged: boolean;
  textPageBgColor: string;
  setTextPageBgColor: (v: string) => void;
  textPageTextColor: string;
  setTextPageTextColor: (v: string) => void;
  textPageHeadingColor: string | null;
  setTextPageHeadingColor: (v: string | null) => void;
  lastSaved?: boolean;
  children?: ReactNode;
}

export default function ContentPageDefaultsSection({
  isOwner,
  saving,
  contentPageChanged,
  textPageBgColor,
  setTextPageBgColor,
  textPageTextColor,
  setTextPageTextColor,
  textPageHeadingColor,
  setTextPageHeadingColor,
  lastSaved,
  children,
}: ContentPageDefaultsSectionProps) {
  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-faint" />
          <span className="text-sm font-medium text-muted">Content Page Defaults</span>
        </div>
        {isOwner && saving === 'content_page' && (
          <span className="flex items-center gap-1.5 text-xs text-faint">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {isOwner && !contentPageChanged && lastSaved && saving !== 'content_page' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <p className="text-xs text-faint mb-4">
        Default colours for text and content pages inside proposals, quotes, and documents. These are the pages your clients read. You can override these per-proposal in the Design tab.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="space-y-2">
            <ColorPickerField label="Page background" value={textPageBgColor} fallback="#141414" onChange={setTextPageBgColor} disabled={!isOwner} />
            <ColorPickerField label="Body text" value={textPageTextColor} fallback="#ffffff" onChange={setTextPageTextColor} disabled={!isOwner} />
            <ColorPickerField label="Heading colour" value={textPageHeadingColor || ''} fallback="" onChange={(v) => setTextPageHeadingColor(v || null)} disabled={!isOwner} />
          </div>
          <p className="text-xs text-faint mt-3">
            Leave heading colour empty to inherit from body text.
          </p>
        </div>

        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
