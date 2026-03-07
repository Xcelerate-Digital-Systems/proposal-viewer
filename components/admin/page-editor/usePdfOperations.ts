// components/admin/page-editor/usePdfOperations.ts

import { useState, useCallback, useEffect } from 'react';
import { PageNameEntry, normalizePageNames, supabase } from '@/lib/supabase';
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
  syncPageCount: (n: number) => void;
  onAfterDelete?: () => void;
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
  setEntries,
  pageCount,
  setPageCount,
  selectedPdfIndex,
  setSelectedId,
  flushPendingSaves,
  remapSaveStatus,
  syncPageCount,
  onAfterDelete,
}: UsePdfOperationsOptions) {
  const confirm = useConfirm();
  const toast = useToast();

  const [processing, setProcessing] = useState(false);
  const [pdfVersion, setPdfVersion] = useState(0);

  // ── Per-page signed URLs ─────────────────────────────────────────
  const [pageUrls, setPageUrls] = useState<PageUrlEntry[]>([]);

  // Route prefix based on entity type
  const apiBase = tableName === 'documents' ? '/api/documents' : '/api/proposals';
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
      // Don't optimistically mutate entries — let fetchPageUrls (triggered by
      // pdfVersion bump) return the fresh list, and the syncPageCount effect in
      // PageEditor will reconcile entries automatically when pageUrls.length changes.
      setPageCount(result.total_pages);
      setSelectedId(`pdf-${afterPage}`);
      toast.success('Page inserted');
      setPdfVersion((v) => v + 1);
    } catch {
      toast.error('Failed to insert page');
    }
    setProcessing(false);
  }, [proposalId, idKey, apiBase, flushPendingSaves, setPageCount, setSelectedId, toast]);

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

      // Remove the deleted page from the local URL list immediately so the
      // preview doesn't briefly try to load a now-deleted storage file.
      // Remaining pages' file_path values in document_pages are unchanged after
      // a delete (only page_number is renumbered), so existing signed URLs stay
      // valid — no need to re-fetch. We call syncPageCount directly instead of
      // relying on the pageUrls.length effect to avoid a stale-read race where
      // fetchPageUrls returns the old count and syncPageCount then re-expands
      // entries back to N.
      setPageUrls((prev) => prev.filter((_, i) => i !== pageIndex));
      setPageCount(result.total_pages);
      syncPageCount(result.total_pages);
      if (selectedPdfIndex >= result.total_pages) {
        setSelectedId(`pdf-${Math.max(0, result.total_pages - 1)}`);
      }
      toast.success(`Page ${pageIndex + 1} deleted`);
      onAfterDelete?.();
      // Re-fetch to replace any stale signed URLs (the optimistic filter above
      // updates the count immediately; this refresh ensures deleted-file URLs
      // are replaced so pages don't show "Failed to load PDF").
      fetchPageUrls();
    } catch {
      toast.error('Failed to delete page');
    }
    setProcessing(false);
  }, [proposalId, idKey, apiBase, tableName, pageCount, selectedPdfIndex, flushPendingSaves, fetchPageUrls, setPageCount, setSelectedId, syncPageCount, onAfterDelete, confirm, toast]);

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