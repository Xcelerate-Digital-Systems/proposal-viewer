// components/admin/shared/TocPreview.tsx
'use client';

import { List } from 'lucide-react';
import { TocSettings, PageNameEntry } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import TocPage, { PageSequenceEntry } from '@/components/viewer/TocPage';
import ViewerPagePreview from './ViewerPagePreview';

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
  const visibleItems = tocItems.filter((item) => !tocSettings.excluded_items.includes(item.id));
  const { pageEntries, pageSequence, numPages } = buildTocPageData(visibleItems);

  const emptyState = numPages === 0 ? (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: branding.bg_primary || '#0f0f0f' }}
    >
      <div className="text-center px-6">
        <List size={28} className="mx-auto mb-3" style={{ color: `${branding.cover_text_color || '#ffffff'}44` }} />
        <p className="text-sm" style={{ color: `${branding.cover_text_color || '#ffffff'}66` }}>No pages selected</p>
      </div>
    </div>
  ) : undefined;

  return (
    <ViewerPagePreview
      branding={branding}
      label={tocSettings.title || 'Table of Contents'}
      icon={<List size={11} />}
      footer={`${visibleItems.length} item${visibleItems.length !== 1 ? 's' : ''} · Scales to fit`}
      emptyState={emptyState}
    >
      <TocPage
        tocSettings={tocSettings}
        branding={branding}
        pageEntries={pageEntries}
        pageSequence={pageSequence}
        numPages={numPages}
        companyName={companyName}
        orientation="landscape"
      />
    </ViewerPagePreview>
  );
}
