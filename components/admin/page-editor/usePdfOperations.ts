// components/admin/page-editor/usePdfOperations.ts

import { useState, useCallback } from 'react';
import { PageNameEntry, normalizePageNames } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface UsePdfOperationsOptions {
  proposalId: string;
  initialPageNames: (PageNameEntry | string)[];
  entries: PageNameEntry[];
  setEntries: React.Dispatch<React.SetStateAction<PageNameEntry[]>>;
  pageCount: number;
  setPageCount: React.Dispatch<React.SetStateAction<number>>;
  selectedPdfIndex: number;
  setSelectedId: (id: string) => void;
  flushPendingSaves: () => Promise<void>;
  remapSaveStatus: (newPageOrder: number[]) => void;
}

export function usePdfOperations({
  proposalId,
  initialPageNames,
  entries,
  setEntries,
  pageCount,
  setPageCount,
  selectedPdfIndex,
  setSelectedId,
  flushPendingSaves,
  remapSaveStatus,
}: UsePdfOperationsOptions) {
  const confirm = useConfirm();
  const toast = useToast();

  const [processing, setProcessing] = useState(false);
  const [pdfVersion, setPdfVersion] = useState(0);

  const handleReplacePage = useCallback(async (pageIndex: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('proposal_id', proposalId);
      formData.append('page_number', (pageIndex + 1).toString());
      formData.append('file', file);
      const res = await fetch('/api/proposals/replace-page', { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to replace page'); }
      else { toast.success(`Page ${pageIndex + 1} replaced`); setPdfVersion((v) => v + 1); }
    } catch { toast.error('Failed to replace page'); }
    setProcessing(false);
  }, [proposalId, flushPendingSaves, toast]);

  const handleInsertPage = useCallback(async (afterPage: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('proposal_id', proposalId);
      formData.append('after_page', afterPage.toString());
      formData.append('file', file);
      const res = await fetch('/api/proposals/insert-page', { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to insert page'); setProcessing(false); return; }
      const result = await res.json();
      setEntries((prev) => {
        const updated = [...prev];
        const newEntries = Array.from({ length: result.pages_inserted || 1 }, (_, idx) => ({ name: `Page ${afterPage + idx + 1}`, indent: 0 }));
        updated.splice(afterPage, 0, ...newEntries);
        return updated;
      });
      setPageCount(result.total_pages);
      setSelectedId(`pdf-${afterPage}`);
      toast.success('Page inserted');
      setPdfVersion((v) => v + 1);
    } catch { toast.error('Failed to insert page'); }
    setProcessing(false);
  }, [proposalId, flushPendingSaves, setEntries, setPageCount, setSelectedId, toast]);

  const handleDeletePage = useCallback(async (pageIndex: number) => {
    if (pageCount <= 1) { toast.error('Cannot delete the only remaining page'); return; }
    const ok = await confirm({
      title: 'Delete page?',
      message: `This will permanently remove page ${pageIndex + 1} from the proposal PDF. This cannot be undone.`,
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    await flushPendingSaves();
    setProcessing(true);
    try {
      const res = await fetch('/api/proposals/delete-page', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, page_number: pageIndex + 1 }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to delete page'); setProcessing(false); return; }
      const result = await res.json();
      setEntries((prev) => { const updated = [...prev]; updated.splice(pageIndex, 1); return updated; });
      setPageCount(result.total_pages);
      if (selectedPdfIndex >= result.total_pages) setSelectedId(`pdf-${Math.max(0, result.total_pages - 1)}`);
      toast.success(`Page ${pageIndex + 1} deleted`);
      setPdfVersion((v) => v + 1);
    } catch { toast.error('Failed to delete page'); }
    setProcessing(false);
  }, [proposalId, pageCount, selectedPdfIndex, flushPendingSaves, setEntries, setPageCount, setSelectedId, confirm, toast]);

  const handleReorder = useCallback(async (newPageOrder: number[]) => {
    const newEntries = newPageOrder.map((origIdx) => entries[origIdx]);
    setEntries(newEntries);
    remapSaveStatus(newPageOrder);

    setProcessing(true);
    try {
      const res = await fetch('/api/proposals/reorder-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, page_order: newPageOrder }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to reorder pages');
        setEntries(normalizePageNames(initialPageNames, initialPageNames.length || 0));
      } else {
        setPdfVersion((v) => v + 1);
      }
    } catch {
      toast.error('Failed to reorder pages');
    }
    setProcessing(false);
  }, [proposalId, entries, initialPageNames, setEntries, remapSaveStatus, toast]);

  return {
    processing,
    pdfVersion,
    handleReplacePage,
    handleInsertPage,
    handleDeletePage,
    handleReorder,
  };
}