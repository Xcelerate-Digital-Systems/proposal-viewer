// components/admin/page-editor/TocPreviewPanel.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TocSettings } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import TocPreview from '@/components/admin/shared/TocPreview';
import { useAuth } from '@/hooks/useAuth';
import type { UnifiedPage } from '@/lib/page-operations';

type TocItem = {
  id: string;
  label: string;
  type: 'pdf' | 'text' | 'pricing' | 'packages' | 'group';
  indent: number;
};

interface TocPreviewPanelProps {
  tocSettings: TocSettings;
  pages: UnifiedPage[];
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function TocPreviewPanel({ tocSettings, pages, onGoPrev, onGoNext, canGoPrev, canGoNext }: TocPreviewPanelProps) {
  const { companyId } = useAuth();
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [companyName, setCompanyName] = useState<string | undefined>();

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const res = await fetch(`/api/company/branding?company_id=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          setBranding({ ...DEFAULT_BRANDING, ...data });
          setCompanyName(data.name || undefined);
        }
      } catch { /* use defaults */ }
    })();
  }, [companyId]);

  const tocItems = useMemo((): TocItem[] => {
    const items: TocItem[] = [];
    let pdfCount = 0;
    for (const page of pages) {
      if (page.type === 'toc') continue;
      if (page.type === 'pdf') {
        pdfCount++;
        items.push({ id: `pdf:${pdfCount}`, label: page.title || `Page ${pdfCount}`, type: 'pdf', indent: page.indent ?? 0 });
      } else if (page.type === 'pricing') {
        items.push({ id: 'pricing', label: page.title || 'Quote', type: 'pricing', indent: page.indent ?? 0 });
      } else if (page.type === 'packages') {
        items.push({ id: `packages:${page.id}`, label: page.title || 'Packages', type: 'packages', indent: page.indent ?? 0 });
      } else if (page.type === 'text') {
        items.push({ id: `text:${page.id}`, label: page.title || 'Untitled', type: 'text', indent: page.indent ?? 0 });
      } else if (page.type === 'section') {
        items.push({ id: `group:${page.title}`, label: page.title || 'Section', type: 'group', indent: page.indent ?? 0 });
      }
    }
    return items;
  }, [pages]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onGoPrev} disabled={!canGoPrev} className="p-1 rounded hover:bg-surface disabled:opacity-30 transition-colors">
          <ChevronLeft size={16} className="text-dim" />
        </button>
        <span className="text-xs text-faint font-medium">Table of Contents</span>
        <button onClick={onGoNext} disabled={!canGoNext} className="p-1 rounded hover:bg-surface disabled:opacity-30 transition-colors">
          <ChevronRight size={16} className="text-dim" />
        </button>
      </div>
      <TocPreview tocSettings={tocSettings} branding={branding} tocItems={tocItems} companyName={companyName} />
    </div>
  );
}
