// components/admin/page-editor/PreviewRouter.tsx
'use client';

import { List, FolderOpen } from 'lucide-react';
import type { UnifiedPage } from './pageEditorTypes';
import type { SaveStatus } from './usePageEditor';
import type { PageNameEntry } from '@/lib/supabase';
import type { PageUrlEntry } from '@/hooks/useProposal';
import PdfPreviewPanel      from './PdfPreviewPanel';
import PricingPreviewPanel  from './PricingPreviewPanel';
import PackagesPreviewPanel from './PackagesPreviewPanel';
import TextPagePreviewPanel from './TextPagePreviewPanel';

interface PreviewRouterProps {
  proposalId: string;
  filePath: string;
  selectedPage: UnifiedPage | null;
  selectedPdfIdx: number;
  saveStatuses: Record<string, SaveStatus>;
  pdfEntries: PageNameEntry[];
  pageUrlEntries: PageUrlEntry[];
  pdfPageCount: number;
  onTextPageUpdate: (pageId: string, changes: Record<string, unknown>) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function PreviewRouter({
  proposalId,
  filePath,
  selectedPage,
  selectedPdfIdx,
  saveStatuses,
  pdfEntries,
  pageUrlEntries,
  pdfPageCount,
  onTextPageUpdate,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
}: PreviewRouterProps) {
  if (!selectedPage) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-300 text-xs">
        Select a page to preview
      </div>
    );
  }

  if (selectedPage.type === 'pricing') {
    return (
      <PricingPreviewPanel
        proposalId={proposalId}
        page={selectedPage}
        onGoPrev={onGoPrev}
        onGoNext={onGoNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />
    );
  }

  if (selectedPage.type === 'packages') {
    return (
      <PackagesPreviewPanel
        proposalId={proposalId}
        page={selectedPage}
        onGoPrev={onGoPrev}
        onGoNext={onGoNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />
    );
  }

  if (selectedPage.type === 'text') {
    return (
      <TextPagePreviewPanel
        proposalId={proposalId}
        page={selectedPage}
        saveStatus={saveStatuses[selectedPage.id] ?? 'idle'}
        onUpdate={onTextPageUpdate}
        onGoPrev={onGoPrev}
        onGoNext={onGoNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />
    );
  }

  if (selectedPage.type === 'toc') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
        <List size={32} className="text-amber-400 mb-3" />
        <p className="text-sm font-medium text-amber-700">Table of Contents</p>
        <p className="text-xs text-amber-500 mt-1 max-w-[240px]">
          Drag to reposition. Configure content and styling in the Contents tab.
        </p>
      </div>
    );
  }

  if (selectedPage.type === 'section') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
        <FolderOpen size={32} className="text-amber-400 mb-3" />
        <p className="text-sm font-medium text-amber-700">Section Header</p>
        <p className="text-xs text-amber-500 mt-1 max-w-[240px]">
          Non-navigable group header. Pages below it appear as children in the sidebar.
        </p>
      </div>
    );
  }

  // pdf (default)
  return (
    <PdfPreviewPanel
      filePath={filePath}
      pdfVersion={0}
      selectedPdfIndex={Math.max(0, selectedPdfIdx)}
      pageCount={pdfPageCount}
      entries={pdfEntries}
      pageUrls={pageUrlEntries}
      onDocLoadSuccess={() => {}}
      onGoPrev={onGoPrev}
      onGoNext={onGoNext}
    />
  );
}
