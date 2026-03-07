// components/admin/page-editor/usePdfOperations.ts

import { useState, useCallback, useEffect } from 'react';
import { PageNameEntry, normalizePageNames, pdfIndexToEntryIndex, supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { PageUrlEntry } from '@/hooks/useProposal';

interface UsePdfOperationsOptions {
  proposalId: string;
  tableName: 'proposals' | 'documents';
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

/**
 * Upload a file directly to Supabase Storage (temp bucket path) from the client,
 * bypassing Vercel's 4.5 MB serverless body limit.
 * Returns the temp storage path, or throws on failure.
 */
async function uploadTempPdf(file: File): Promise<string> {
  const ext = file.name.endsWith('.pdf') ? '.pdf' : '';
  const tempPath = `temp/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage
    .from('proposals')
    .upload(tempPath, file, { contentType: 'application/pdf', upsert: false });
  if (error) throw new Error(`Temp upload failed: ${error.message}`);
  return tempPath;
}

export function usePdfOperations({
  proposalId,
  tableName,
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

  // ── Per-page signed URLs ─────────────────────────────────────────
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);

  // Route prefix based on entity type — no ambiguous table_name param needed
  const apiBase = tableName === 'documents' ? '/api/documents' : '/api/proposals';
  // The body ID key matches the route expectation
  const idKey = tableName === 'documents' ? 'document_id' : 'proposal_id';

  const fetchPageUrls = useCallback(async () => {
    try {
      const params = new URLSearchParams({ entity_id: proposalId });
      const res = await fetch(`${apiBase}/page-urls?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.fallback) {
        setPageUrls([]);
      } else {
        setPageUrls(data.pages ?? []);
      }
    } catch {
      // Non-fatal — legacy mode stays active
    }
  }, [proposalId, apiBase]);

  // Fetch on mount
  useEffect(() => {
    fetchPageUrls();
  }, [fetchPageUrls]);

  // Re-fetch after every operation that changes page content / order
  useEffect(() => {
    if (pdfVersion === 0) return;
    fetchPageUrls();
  }, [pdfVersion, fetchPageUrls]);

  // ── Mutations ────────────────────────────────────────────────────

  const handleReplacePage = useCallback(async (pageIndex: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    try {
      const tempPath = await uploadTempPdf(file);

      const res = await fetch(`${apiBase}/replace-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idKey]:     proposalId,
          page_number: pageIndex + 1,
          temp_path:   tempPath,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to replace page');
      } else {
        toast.success(`Page ${pageIndex + 1} replaced`);
        setPdfVersion((v) => v + 1);
      }
    } catch {
      toast.error('Failed to replace page');
    }
    setProcessing(false);
  }, [proposalId, idKey, apiBase, flushPendingSaves, toast]);

  const handleInsertPage = useCallback(async (afterPage: number, file: File) => {
    await flushPendingSaves();
    setProcessing(true);
    try {
      const tempPath = await uploadTempPdf(file);

      const res = await fetch(`${apiBase}/insert-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idKey]:    proposalId,
          after_page: afterPage,
          temp_path:  tempPath,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to insert page');
        setProcessing(false);
        return;
      }
      const result = await res.json();
      setEntries((prev) => {
        const updated = [...prev];
        const newEntries = Array.from(
          { length: result.pages_inserted || 1 },
          (_, idx) => ({ name: `Page ${afterPage + idx + 1}`, indent: 0 })
        );
        let entryInsertIdx: number;
        if (afterPage === 0) {
          entryInsertIdx = 0;
        } else {
          const prevIdx = pdfIndexToEntryIndex(updated, afterPage - 1);
          entryInsertIdx = prevIdx >= 0 ? prevIdx + 1 : updated.length;
        }
        updated.splice(entryInsertIdx, 0, ...newEntries);
        return updated;
      });
      setPageCount(result.total_pages);
      setSelectedId(`pdf-${afterPage}`);
      toast.success('Page inserted');
      setPdfVersion((v) => v + 1);
    } catch {
      toast.error('Failed to insert page');
    }
    setProcessing(false);
  }, [proposalId, idKey, apiBase, flushPendingSaves, setEntries, setPageCount, setSelectedId, toast]);

  const handleDeletePage = useCallback(async (pageIndex: number) => {
    if (pageCount <= 1) { toast.error('Cannot delete the only remaining page'); return; }
    const ok = await confirm({
      title: 'Delete page?',
      message: `This will permanently remove page ${pageIndex + 1} from the ${tableName === 'documents' ? 'document' : 'proposal'} PDF. This cannot be undone.`,
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    await flushPendingSaves();
    setProcessing(true);
    try {
      const res = await fetch(`${apiBase}/delete-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idKey]:     proposalId,
          page_number: pageIndex + 1,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete page');
        setProcessing(false);
        return;
      }
      const result = await res.json();
      setEntries((prev) => {
        const updated = [...prev];
        const entryIdx = pdfIndexToEntryIndex(updated, pageIndex);
        if (entryIdx >= 0) updated.splice(entryIdx, 1);
        return updated;
      });
      setPageCount(result.total_pages);
      if (selectedPdfIndex >= result.total_pages) setSelectedId(`pdf-${Math.max(0, result.total_pages - 1)}`);
      toast.success(`Page ${pageIndex + 1} deleted`);
      setPdfVersion((v) => v + 1);
    } catch {
      toast.error('Failed to delete page');
    }
    setProcessing(false);
  }, [proposalId, idKey, apiBase, tableName, pageCount, selectedPdfIndex, flushPendingSaves, setEntries, setPageCount, setSelectedId, confirm, toast]);

  const handleReorder = useCallback(async (newPageOrder: number[]) => {
    remapSaveStatus(newPageOrder);
    setProcessing(true);
    try {
      const res = await fetch(`${apiBase}/reorder-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idKey]:    proposalId,
          page_order: newPageOrder,
        }),
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
  }, [proposalId, idKey, apiBase, initialPageNames, setEntries, remapSaveStatus, toast]);

  return {
    processing,
    pdfVersion,
    pageUrls,
    handleReplacePage,
    handleInsertPage,
    handleDeletePage,
    handleReorder,
  };
}