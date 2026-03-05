// components/admin/shared/TocPreview.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { List } from 'lucide-react';
import { TocSettings, PageNameEntry } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import TocPage, { PageSequenceEntry } from '@/components/viewer/TocPage';

/* ─── Types ──────────────────────────────────────────────────────────── */

type TocItem = {
  id: string;
  label: string;
  type: 'pdf' | 'text' | 'pricing' | 'packages' | 'group';
  indent: number;
};

interface TocPreviewProps {
  tocSettings: TocSettings;
  branding: CompanyBranding;
  tocItems: TocItem[];
  companyName?: string;
}

/* ─── Helper ─────────────────────────────────────────────────────────── */

function buildTocPageData(items: TocItem[]): {
  pageEntries: PageNameEntry[];
  pageSequence: PageSequenceEntry[];
  numPages: number;
} {
  const pageEntries: PageNameEntry[] = [];
  const pageSequence: PageSequenceEntry[] = [];
  let numPages = 0;

  for (const item of items) {
    if (item.type === 'group') {
      pageEntries.push({ name: item.label, indent: item.indent, type: 'group' });
    } else {
      pageEntries.push({ name: item.label, indent: item.indent });
      numPages++;
      if (item.type === 'pdf') {
        const pdfPage = parseInt(item.id.replace('pdf:', ''), 10) || numPages;
        pageSequence.push({ type: 'pdf', pdfPage });
      } else if (item.type === 'pricing') {
        pageSequence.push({ type: 'pricing' });
      } else if (item.type === 'packages') {
        const packagesId = item.id.startsWith('packages:') ? item.id.replace('packages:', '') : undefined;
        pageSequence.push({ type: 'packages', packagesId });
      } else if (item.type === 'text') {
        const textPageId = item.id.replace('text:', '');
        pageSequence.push({ type: 'text', textPageId });
      }
    }
  }

  return { pageEntries, pageSequence, numPages };
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function TocPreview({ tocSettings, branding, tocItems, companyName }: TocPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.45);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        setPreviewScale(Math.min(0.55, width / 900));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  const { pageEntries, pageSequence, numPages } = buildTocPageData(tocItems);
  const includedCount = tocItems.filter((item) => !tocSettings.excluded_items.includes(item.id)).length;

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-0 sticky top-0 self-start"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
        {/* Header bar */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Live Preview</span>
          <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
            <List size={11} /> {tocSettings.title || 'Table of Contents'}
          </span>
        </div>

        {/* Scaled content */}
        <div className="flex-1 min-h-[400px] overflow-hidden relative">
          {numPages > 0 ? (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                transformOrigin: 'top left',
                transform: `scale(${previewScale})`,
                width: `${100 / previewScale}%`,
                height: `${100 / previewScale}%`,
              }}
            >
              <TocPage
                tocSettings={tocSettings}
                branding={branding}
                pageEntries={pageEntries}
                pageSequence={pageSequence}
                numPages={numPages}
                companyName={companyName}
              />
            </div>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: branding.bg_primary || '#0f0f0f' }}
            >
              <div className="text-center px-6">
                <List size={28} className="mx-auto mb-3" style={{ color: `${branding.cover_text_color || '#ffffff'}44` }} />
                <p className="text-sm" style={{ color: `${branding.cover_text_color || '#ffffff'}66` }}>
                  No pages selected
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
          <span className="text-[10px] text-gray-400">
            {includedCount} item{includedCount !== 1 ? 's' : ''} · Scales to fit
          </span>
        </div>
      </div>
    </div>
  );
}