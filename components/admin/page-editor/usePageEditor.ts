// components/admin/page-editor/usePageEditor.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { UnifiedPage, PageType } from '@/lib/page-operations';

export type { UnifiedPage, PageType };

export type SaveStatus = 'idle' | 'saving' | 'saved';

export type EntityType = 'proposal' | 'document' | 'template';

/* ─── Signed URL map ─────────────────────────────────────────────────────── */

// Keyed by page ID — only populated for pdf type pages
export type SignedUrlMap = Record<string, string>;

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export function usePageEditor(entityId: string, entityType: EntityType) {
  const confirm = useConfirm();
  const toast   = useToast();

  /* ── State ────────────────────────────────────────────────────────────── */

  const [pages, setPages]               = useState<UnifiedPage[]>([]);
  const [pagesLoaded, setPagesLoaded]   = useState(false);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [processing, setProcessing]     = useState(false);
  const [signedUrls, setSignedUrls]     = useState<SignedUrlMap>({});

  const debounces = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // API base and entity param key for this entity type
  const apiBase = entityType === 'document'
    ? '/api/documents/pages'
    : entityType === 'template'
    ? '/api/templates/pages'
    : '/api/proposals/pages';

  const idKey = entityType === 'document'
    ? 'document_id'
    : entityType === 'template'
    ? 'template_id'
    : 'proposal_id';

  /* ── Cleanup ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    return () => { Object.values(debounces.current).forEach(clearTimeout); };
  }, []);

  /* ── Load pages ───────────────────────────────────────────────────────── */

  const loadPages = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}?${idKey}=${entityId}`);
      if (!res.ok) return;
      const data: UnifiedPage[] = await res.json();
      setPages(data);
      // Generate signed URLs for all PDF pages in parallel
      generateSignedUrls(data);
    } catch {
      // Non-fatal
    } finally {
      setPagesLoaded(true);
    }
  }, [entityId, apiBase, idKey]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  /* ── Signed URLs ──────────────────────────────────────────────────────── */

  const generateSignedUrls = useCallback(async (pageList: UnifiedPage[]) => {
    const pdfPages = pageList.filter((p) => p.type === 'pdf' && p.payload?.file_path);
    if (pdfPages.length === 0) return;

    const entries = await Promise.all(
      pdfPages.map(async (p) => {
        const filePath = p.payload.file_path as string;
        const { data } = await supabase.storage
          .from('proposals')
          .createSignedUrl(filePath, 2592000);
        return [p.id, data?.signedUrl ?? null] as const;
      })
    );

    setSignedUrls((prev) => {
      const next = { ...prev };
      for (const [id, url] of entries) {
        if (url) next[id] = url;
      }
      return next;
    });
  }, []);

  /* ── Save status helpers ──────────────────────────────────────────────── */

  const setSaving = (pageId: string) =>
    setSaveStatuses((prev) => ({ ...prev, [pageId]: 'saving' }));

  const setSaved = (pageId: string) => {
    setSaveStatuses((prev) => ({ ...prev, [pageId]: 'saved' }));
    setTimeout(() => {
      setSaveStatuses((prev) => {
        const next = { ...prev };
        if (next[pageId] === 'saved') delete next[pageId];
        return next;
      });
    }, 1500);
  };

  /* ── updatePage (debounced) ───────────────────────────────────────────── */

  const updatePage = useCallback((pageId: string, changes: Partial<UnifiedPage> & { payload_patch?: Record<string, unknown> }) => {
    // Optimistic update
    setPages((prev) =>
      prev.map((p) => p.id !== pageId ? p : { ...p, ...changes })
    );

    if (debounces.current[pageId]) clearTimeout(debounces.current[pageId]);
    setSaving(pageId);

    debounces.current[pageId] = setTimeout(async () => {
      delete debounces.current[pageId];
      try {
        const res = await fetch(`${apiBase}?id=${pageId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(changes),
        });
        if (!res.ok) {
          toast.error('Failed to save page');
          return;
        }
        const updated: UnifiedPage = await res.json();
        // Reconcile with server response
        setPages((prev) => prev.map((p) => p.id === pageId ? updated : p));
        setSaved(pageId);
        // If PDF file path changed, refresh that page's signed URL
        if (updated.type === 'pdf') {
          generateSignedUrls([updated]);
        }
      } catch {
        toast.error('Failed to save page');
      }
    }, 800);
  }, [apiBase, toast, generateSignedUrls]);

  /* ── updatePageImmediate (no debounce — for position/order changes) ────── */

  const updatePageImmediate = useCallback(async (pageId: string, changes: Partial<UnifiedPage>) => {
    setPages((prev) => prev.map((p) => p.id !== pageId ? p : { ...p, ...changes }));
    try {
      await fetch(`${apiBase}?id=${pageId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(changes),
      });
    } catch {
      toast.error('Failed to save page');
    }
  }, [apiBase, toast]);

  /* ── addPage ──────────────────────────────────────────────────────────── */

  const addPage = useCallback(async (
    type: PageType,
    opts?: {
      position?:        number;
      title?:           string;
      payload?:         Record<string, unknown>;
      indent?:          number;
      link_url?:        string | null;
      link_label?:      string | null;
      orientation?:     string;
      show_title?:      boolean;
      show_member_badge?: boolean;
    }
  ): Promise<UnifiedPage | null> => {
    try {
      const res = await fetch(apiBase, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          [idKey]: entityId,
          type,
          ...opts,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? `Failed to add ${type} page`);
        return null;
      }
      const newPage: UnifiedPage = await res.json();
      setPages((prev) => [...prev, newPage].sort((a, b) => a.position - b.position));
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} page added`);
      return newPage;
    } catch {
      toast.error(`Failed to add ${type} page`);
      return null;
    }
  }, [entityId, idKey, apiBase, toast]);

  /* ── deletePage ───────────────────────────────────────────────────────── */

  const deletePage = useCallback(async (pageId: string): Promise<boolean> => {
    const page = pages.find((p) => p.id === pageId);

    const ok = await confirm({
      title:        'Delete page?',
      message:      `This will permanently remove this ${page?.type ?? 'page'}. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive:  true,
    });
    if (!ok) return false;

    setProcessing(true);
    try {
      const res = await fetch(apiBase, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          [idKey]: entityId,
          page_id: pageId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to delete page');
        return false;
      }

      setPages((prev) => prev.filter((p) => p.id !== pageId));
      setSignedUrls((prev) => { const next = { ...prev }; delete next[pageId]; return next; });
      toast.success('Page deleted');
      return true;
    } catch {
      toast.error('Failed to delete page');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [entityId, idKey, apiBase, pages, confirm, toast]);

  /* ── reorderPages ─────────────────────────────────────────────────────── */

  const reorderPages = useCallback(async (orderedIds: string[]): Promise<boolean> => {
    // Optimistic: re-sort local state immediately
    setPages((prev) => {
      const byId = Object.fromEntries(prev.map((p) => [p.id, p]));
      return orderedIds
        .map((id, i) => byId[id] ? { ...byId[id], position: i } : null)
        .filter((p): p is UnifiedPage => p !== null);
    });

    try {
      const res = await fetch(`${apiBase}/reorder`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          [idKey]:     entityId,
          ordered_ids: orderedIds,
        }),
      });
      if (!res.ok) {
        toast.error('Failed to save order');
        // Reload to get correct state from DB
        await loadPages();
        return false;
      }
      return true;
    } catch {
      toast.error('Failed to save order');
      await loadPages();
      return false;
    }
  }, [entityId, idKey, apiBase, loadPages, toast]);

  /* ── insertPdfPage ────────────────────────────────────────────────────── */

  /**
   * Uploads a PDF file directly to Supabase Storage (bypassing Vercel's
   * 4.5 MB body limit), then calls the API to register the new page.
   *
   * @param file           Raw PDF file from the user's file input
   * @param afterPosition  0-based position to insert after (-1 = prepend)
   */
  const insertPdfPage = useCallback(async (file: File, afterPosition: number): Promise<boolean> => {
    setProcessing(true);
    try {
      // Upload to temp path in storage directly from client
      const safeName = `page-${Date.now()}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const entityFolder = entityType === 'template' ? 'templates' : entityType === 'document' ? 'documents' : 'proposals';
      const tempPath = `${entityFolder}/${entityId}/temp/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('proposals')
        .upload(tempPath, file, { contentType: 'application/pdf', upsert: false });

      if (uploadError) {
        toast.error('Failed to upload page');
        return false;
      }

      const res = await fetch(apiBase, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          op:             'insert_pdf',
          [idKey]:        entityId,
          after_position: afterPosition,
          temp_path:      tempPath,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to insert page');
        return false;
      }

      const { page } = await res.json();
      if (page) {
        setPages((prev) =>
          [...prev, page].sort((a: UnifiedPage, b: UnifiedPage) => a.position - b.position)
        );
        // Re-number positions locally to match server
        await loadPages();
        generateSignedUrls([page]);
      }

      toast.success('Page inserted');
      return true;
    } catch {
      toast.error('Failed to insert page');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [entityId, entityType, idKey, apiBase, loadPages, generateSignedUrls, toast]);

  /* ── replacePdfPage ───────────────────────────────────────────────────── */

  /**
   * Uploads a replacement PDF file, then swaps the file_path on the existing
   * page row. Page ID and position are unchanged.
   */
  const replacePdfPage = useCallback(async (pageId: string, file: File): Promise<boolean> => {
  setProcessing(true);
  try {
    // Get current page to find existing file path
    const currentPage = pages.find((p) => p.id === pageId);
    const existingPath = currentPage?.payload?.file_path as string | undefined;

    if (!existingPath) {
      toast.error('Cannot replace: page has no existing file');
      return false;
    }

    // Overwrite in-place (upsert: true) — same path, new content
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(existingPath, file, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      toast.error('Failed to upload replacement page');
      return false;
    }

    // No DB update needed — path hasn't changed
    // Just refresh the signed URL (Supabase signed URLs are path-based so a new one is needed)
    generateSignedUrls([currentPage!]);
    toast.success('Page replaced');
    return true;
  } catch {
    toast.error('Failed to replace page');
    return false;
  } finally {
    setProcessing(false);
  }
}, [entityId, entityType, pages, generateSignedUrls, toast]);

  /* ── flushSaves ───────────────────────────────────────────────────────── */

  /**
   * Flushes all pending debounced saves immediately.
   * Call before navigating away or closing the editor.
   */
  const flushSaves = useCallback(async () => {
    const pending = Object.entries(debounces.current);
    if (pending.length === 0) return;

    for (const [pageId, timer] of pending) {
      clearTimeout(timer);
      delete debounces.current[pageId];
    }

    // Fire saves for all pages that had pending debounces
    const pendingIds = new Set(pending.map(([id]) => id));
    const saves = pages
      .filter((p) => pendingIds.has(p.id))
      .map((p) =>
        fetch(`${apiBase}?id=${p.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          // Send full page as changes — server only applies defined fields
          body:    JSON.stringify({
            title:                 p.title,
            indent:                p.indent,
            enabled:               p.enabled,
            link_url:              p.link_url,
            link_label:            p.link_label,
            orientation:           p.orientation,
            show_title:            p.show_title,
            show_member_badge:     p.show_member_badge,
            prepared_by_member_id: p.prepared_by_member_id,
            payload:               p.payload,
          }),
        }).catch(() => {})
      );

    await Promise.all(saves);
  }, [pages, apiBase]);

  /* ── Derived helpers ──────────────────────────────────────────────────── */

  // Pages ordered by position (the canonical order for rendering)
  const orderedPages = pages.slice().sort((a, b) => a.position - b.position);

  // Subset helpers for components that still want typed slices
  const pdfPages      = orderedPages.filter((p) => p.type === 'pdf');
  const textPages     = orderedPages.filter((p) => p.type === 'text');
  const pricingPages  = orderedPages.filter((p) => p.type === 'pricing');
  const packagePages  = orderedPages.filter((p) => p.type === 'packages');
  const tocPages      = orderedPages.filter((p) => p.type === 'toc');
  const sectionPages  = orderedPages.filter((p) => p.type === 'section');

  return {
    // Core state
    pages: orderedPages,
    pagesLoaded,
    saveStatuses,
    processing,
    signedUrls,

    // Typed subsets (convenience)
    pdfPages,
    textPages,
    pricingPages,
    packagePages,
    tocPages,
    sectionPages,

    // Mutations
    addPage,
    updatePage,
    updatePageImmediate,
    deletePage,
    reorderPages,
    insertPdfPage,
    replacePdfPage,

    // Utility
    flushSaves,
    loadPages,   // force re-fetch if needed
  };
}