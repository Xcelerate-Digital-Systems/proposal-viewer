// components/admin/page-editor/useTextPagesState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export interface TextPageData {
  id: string;
  enabled: boolean;
  position: number;
  title: string;
  content: unknown; // TipTap JSON
  sort_order: number;
}

interface UseTextPagesStateOptions {
  entityId: string;
  entityType: 'proposal' | 'template';
}

const DEFAULT_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function useTextPagesState({ entityId, entityType }: UseTextPagesStateOptions) {
  const confirm = useConfirm();
  const toast = useToast();

  const [textPagesLoaded, setTextPagesLoaded] = useState(false);
  const [textPages, setTextPages] = useState<TextPageData[]>([]);
  const [textPageSaveStatuses, setTextPageSaveStatuses] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const apiBase = entityType === 'proposal'
    ? '/api/proposals/text-pages'
    : '/api/templates/text-pages';
  const idParam = entityType === 'proposal' ? 'proposal_id' : 'template_id';

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Load text pages
  useEffect(() => {
    const fetchTextPages = async () => {
      try {
        const res = await fetch(`${apiBase}?${idParam}=${entityId}`);
        if (res.ok) {
          const data: TextPageData[] = await res.json();
          setTextPages(data.filter((tp) => tp.enabled));
        }
      } catch {
        // No text pages yet
      }
      setTextPagesLoaded(true);
    };
    fetchTextPages();
  }, [entityId, apiBase, idParam]);

  // Save a single text page to API
  const saveTextPage = useCallback(async (page: TextPageData) => {
    setTextPageSaveStatuses((prev) => ({ ...prev, [page.id]: 'saving' }));
    try {
      await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idParam]: entityId,
          id: page.id,
          enabled: page.enabled,
          position: page.position,
          title: page.title,
          content: page.content,
          sort_order: page.sort_order,
        }),
      });
      setTextPageSaveStatuses((prev) => ({ ...prev, [page.id]: 'saved' }));
      setTimeout(() => {
        setTextPageSaveStatuses((prev) => ({ ...prev, [page.id]: 'idle' }));
      }, 2000);
    } catch {
      toast.error('Failed to save text page');
      setTextPageSaveStatuses((prev) => ({ ...prev, [page.id]: 'idle' }));
    }
  }, [apiBase, idParam, entityId, toast]);

  // Schedule debounced save for a specific text page
  const scheduleSave = useCallback((pageId: string, page: TextPageData) => {
    if (debounceTimers.current[pageId]) clearTimeout(debounceTimers.current[pageId]);
    debounceTimers.current[pageId] = setTimeout(() => {
      saveTextPage(page);
      delete debounceTimers.current[pageId];
    }, 800);
  }, [saveTextPage]);

  // Update a text page and schedule save
  const updateTextPage = useCallback((pageId: string, changes: Partial<TextPageData>) => {
    setTextPages((prev) => {
      const updated = prev.map((tp) =>
        tp.id === pageId ? { ...tp, ...changes } : tp
      );
      const page = updated.find((tp) => tp.id === pageId);
      if (page) scheduleSave(pageId, page);
      return updated;
    });
  }, [scheduleSave]);

  // Update position for a text page (immediate save, no debounce)
  const updateTextPagePosition = useCallback((pageId: string, position: number) => {
    setTextPages((prev) => {
      const updated = prev.map((tp) =>
        tp.id === pageId ? { ...tp, position } : tp
      );
      const page = updated.find((tp) => tp.id === pageId);
      if (page) saveTextPage(page);
      return updated;
    });
  }, [saveTextPage]);

  // Flush all pending saves
  const flushTextPageSaves = useCallback(async () => {
    const pendingTimers = { ...debounceTimers.current };
    Object.keys(pendingTimers).forEach((key) => {
      clearTimeout(pendingTimers[key]);
      delete debounceTimers.current[key];
    });
    const pendingIds = Object.keys(pendingTimers);
    if (pendingIds.length > 0) {
      const saves = textPages
        .filter((tp) => pendingIds.includes(tp.id))
        .map((tp) => saveTextPage(tp));
      await Promise.all(saves);
    }
  }, [textPages, saveTextPage]);

  // Add a new text page
  const addTextPage = useCallback(async (): Promise<TextPageData | null> => {
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idParam]: entityId,
          enabled: true,
          position: -1,
          title: 'Executive Summary',
          content: DEFAULT_CONTENT,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to add text page');
        return null;
      }

      const newPage: TextPageData = await res.json();
      setTextPages((prev) => [...prev, newPage]);
      toast.success('Text page added');
      return newPage;
    } catch {
      toast.error('Failed to add text page');
      return null;
    }
  }, [apiBase, idParam, entityId, toast]);

  // Remove (delete) a text page
  const removeTextPage = useCallback(async (pageId: string): Promise<boolean> => {
    const ok = await confirm({
      title: 'Remove text page?',
      message: 'This will permanently delete this text page and its content. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return false;

    try {
      const res = await fetch(`${apiBase}?id=${pageId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete text page');
        return false;
      }

      // Clear any pending debounce timer
      if (debounceTimers.current[pageId]) {
        clearTimeout(debounceTimers.current[pageId]);
        delete debounceTimers.current[pageId];
      }

      setTextPages((prev) => prev.filter((tp) => tp.id !== pageId));
      toast.success('Text page removed');
      return true;
    } catch {
      toast.error('Failed to delete text page');
      return false;
    }
  }, [apiBase, confirm, toast]);

  return {
    textPagesLoaded,
    textPages,
    setTextPages,
    textPageSaveStatuses,
    updateTextPage,
    updateTextPagePosition,
    flushTextPageSaves,
    addTextPage,
    removeTextPage,
    saveTextPage,
  };
}