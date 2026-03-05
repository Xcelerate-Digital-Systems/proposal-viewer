// components/admin/page-editor/usePageEditorState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { PageNameEntry, normalizePageNamesWithGroups } from '@/lib/supabase';

/**
 * Manages the PDF page entries (names, indents, section groups) for the
 * PageEditor. Handles debounced per-entry saves, group CRUD, and
 * utilities needed by usePdfOperations (flush, forceSave, remap).
 */
export function usePageEditorState(
  proposalId: string,
  initialPageNames: (PageNameEntry | string)[],
  tableName: 'proposals' | 'documents' = 'proposals',
) {
  const [entries, setEntries] = useState<PageNameEntry[]>(() =>
    normalizePageNamesWithGroups(
      initialPageNames,
      initialPageNames.filter(
        (e) => typeof e === 'string' || (e as PageNameEntry).type !== 'group'
      ).length
    )
  );

  const [pageCount, setPageCount] = useState<number>(() =>
    entries.filter((e) => e.type !== 'group').length
  );

  const [saveStatus, setSaveStatus] = useState<Record<number, 'idle' | 'saving' | 'saved'>>({});
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => { Object.values(debounceTimers.current).forEach(clearTimeout); };
  }, []);

  /* ── Save entries to API ──────────────────────────────────── */

  const saveEntries = useCallback(async (entriesToSave: PageNameEntry[]) => {
    const apiPath = tableName === 'documents' ? '/api/documents' : '/api/proposals';
    try {
      await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proposalId, page_names: entriesToSave }),
      });
    } catch {
      // Non-critical
    }
  }, [proposalId, tableName]);

  const forceSaveEntries = useCallback(async (entriesToSave: PageNameEntry[]) => {
    await saveEntries(entriesToSave);
  }, [saveEntries]);

  /* ── Schedule debounced save for a single entry ──────────── */

  const scheduleSave = useCallback((index: number, currentEntries: PageNameEntry[]) => {
    if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
    setSaveStatus((prev) => ({ ...prev, [index]: 'saving' }));
    debounceTimers.current[index] = setTimeout(async () => {
      delete debounceTimers.current[index];
      await saveEntries(currentEntries);
      setSaveStatus((prev) => ({ ...prev, [index]: 'saved' }));
      setTimeout(() => {
        setSaveStatus((prev) => {
          const next = { ...prev };
          if (next[index] === 'saved') delete next[index];
          return next;
        });
      }, 1500);
    }, 800);
  }, [saveEntries]);

  /* ── Update a single entry ────────────────────────────────── */

  const updateEntry = useCallback((index: number, changes: Partial<PageNameEntry>) => {
    setEntries((prev) => {
      const updated = prev.map((e, i) => i === index ? { ...e, ...changes } : e);
      scheduleSave(index, updated);
      return updated;
    });
  }, [scheduleSave]);

  /* ── Flush all pending saves ─────────────────────────────── */

  const flushPendingSaves = useCallback(async () => {
    const pending = { ...debounceTimers.current };
    Object.values(pending).forEach(clearTimeout);
    debounceTimers.current = {};
    if (Object.keys(pending).length > 0) {
      await new Promise<void>((resolve) => {
        setEntries((current) => {
          saveEntries(current).then(resolve);
          return current;
        });
      });
    }
  }, [saveEntries]);

  /* ── Sync page count from PDF load ──────────────────────── */

  const syncPageCount = useCallback((n: number) => {
    setPageCount(n);
    setEntries((prev) => {
      const groups: { beforePdfIndex: number; entry: PageNameEntry }[] = [];
      const realEntries: PageNameEntry[] = [];
      for (const entry of prev) {
        if (entry.type === 'group') {
          groups.push({ beforePdfIndex: realEntries.length, entry });
        } else {
          realEntries.push(entry);
        }
      }
      if (realEntries.length === n) return prev;
      while (realEntries.length < n) {
        realEntries.push({ name: `Page ${realEntries.length + 1}`, indent: 0 });
      }
      const trimmed = realEntries.slice(0, n);
      const result: PageNameEntry[] = [];
      let realIdx = 0;
      let groupIdx = 0;
      while (realIdx < trimmed.length || groupIdx < groups.length) {
        while (groupIdx < groups.length && groups[groupIdx].beforePdfIndex <= realIdx) {
          result.push(groups[groupIdx].entry);
          groupIdx++;
        }
        if (realIdx < trimmed.length) { result.push(trimmed[realIdx]); realIdx++; }
      }
      while (groupIdx < groups.length) { result.push(groups[groupIdx].entry); groupIdx++; }
      return result;
    });
  }, []);

  /* ── Remap save statuses after reorder ──────────────────── */

  const remapSaveStatus = useCallback((newPageOrder: number[]) => {
    setSaveStatus((prev) => {
      const next: Record<number, 'idle' | 'saving' | 'saved'> = {};
      newPageOrder.forEach((oldIdx, newIdx) => {
        if (prev[oldIdx]) next[newIdx] = prev[oldIdx];
      });
      return next;
    });
  }, []);

  /* ── Group CRUD ──────────────────────────────────────────── */

  const addGroup = useCallback((name: string) => {
    setEntries((prev) => {
      const updated = [...prev, { name, type: 'group' as const, indent: 0 }];
      saveEntries(updated);
      return updated;
    });
  }, [saveEntries]);

  const removeGroup = useCallback((index: number) => {
    setEntries((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      saveEntries(updated);
      return updated;
    });
  }, [saveEntries]);

  return {
    entries,
    setEntries,
    pageCount,
    setPageCount,
    saveStatus,
    updateEntry,
    syncPageCount,
    flushPendingSaves,
    forceSaveEntries,
    remapSaveStatus,
    addGroup,
    removeGroup,
  };
}