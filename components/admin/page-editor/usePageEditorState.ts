// components/admin/page-editor/usePageEditorState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, PageNameEntry, normalizePageNames } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

export function usePageEditorState(
  proposalId: string,
  initialPageNames: (PageNameEntry | string)[],
  tableName: 'proposals' | 'documents' = 'proposals'
) {
  const toast = useToast();

  const [entries, setEntries] = useState<PageNameEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<Record<number, 'saving' | 'saved' | null>>({});
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const dirtyRowsRef = useRef(dirtyRows);
  dirtyRowsRef.current = dirtyRows;

  // Initialize entries from props
  useEffect(() => {
    setEntries(normalizePageNames(initialPageNames, initialPageNames.length || 0));
  }, [initialPageNames]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      Object.values(savedTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Sync entries when PDF loads (ensure we have enough entries for all pages)
  // Preserves group entries (section headers) which don't count as PDF pages
  const syncPageCount = useCallback((numPages: number) => {
    setPageCount(numPages);
    setEntries((prev) => {
      // Separate groups from real page entries
      const groups: { beforePdfIndex: number; entry: PageNameEntry }[] = [];
      const realEntries: PageNameEntry[] = [];
      for (const entry of prev) {
        if (entry.type === 'group') {
          groups.push({ beforePdfIndex: realEntries.length, entry });
        } else {
          realEntries.push(entry);
        }
      }

      // Pad/trim real entries to match PDF page count
      while (realEntries.length < numPages) realEntries.push({ name: `Page ${realEntries.length + 1}`, indent: 0 });
      const trimmed = realEntries.slice(0, numPages);

      // Re-insert groups at their original positions
      const result: PageNameEntry[] = [];
      let realIdx = 0;
      let groupIdx = 0;
      while (realIdx < trimmed.length || groupIdx < groups.length) {
        while (groupIdx < groups.length && groups[groupIdx].beforePdfIndex <= realIdx) {
          result.push(groups[groupIdx].entry);
          groupIdx++;
        }
        if (realIdx < trimmed.length) {
          result.push(trimmed[realIdx]);
          realIdx++;
        }
      }
      while (groupIdx < groups.length) {
        result.push(groups[groupIdx].entry);
        groupIdx++;
      }

      return result;
    });
  }, []);

  // Save entries to database
  const saveEntries = useCallback(async (entriesToSave: PageNameEntry[], rowsToMark: Set<number>) => {
    const savingStatus: Record<number, 'saving'> = {};
    rowsToMark.forEach((idx) => { savingStatus[idx] = 'saving'; });
    setSaveStatus((prev) => ({ ...prev, ...savingStatus }));

    try {
      await supabase.from(tableName).update({ page_names: entriesToSave }).eq('id', proposalId);
      const savedStatus: Record<number, 'saved'> = {};
      rowsToMark.forEach((idx) => { savedStatus[idx] = 'saved'; });
      setSaveStatus((prev) => ({ ...prev, ...savedStatus }));
      rowsToMark.forEach((idx) => {
        if (savedTimers.current[idx]) clearTimeout(savedTimers.current[idx]);
        savedTimers.current[idx] = setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [idx]: null }));
        }, 2000);
      });
    } catch {
      toast.error('Failed to save');
      const clearedStatus: Record<number, null> = {};
      rowsToMark.forEach((idx) => { clearedStatus[idx] = null; });
      setSaveStatus((prev) => ({ ...prev, ...clearedStatus }));
    }
  }, [proposalId, toast]);

  // Schedule a debounced save
  const scheduleSave = useCallback((delay: number, changedIndex: number) => {
    setDirtyRows((prev) => { const next = new Set(prev); next.add(changedIndex); return next; });
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const currentEntries = entriesRef.current;
      const currentDirty = new Set(dirtyRowsRef.current);
      setDirtyRows(new Set());
      saveEntries(currentEntries, currentDirty);
      debounceTimer.current = null;
    }, delay);
  }, [saveEntries]);

  // Flush any pending debounced saves immediately
  const flushPendingSaves = useCallback(async () => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
    const currentDirty = new Set(dirtyRowsRef.current);
    if (currentDirty.size > 0) { setDirtyRows(new Set()); await saveEntries(entriesRef.current, currentDirty); }
  }, [saveEntries]);

  // Update a single entry and schedule save
  const updateEntry = useCallback((index: number, changes: Partial<PageNameEntry>) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...changes };
      return updated;
    });
    scheduleSave(changes.indent !== undefined ? 0 : 800, index);
  }, [scheduleSave]);

  // Remap save statuses after reorder
  const remapSaveStatus = useCallback((newPageOrder: number[]) => {
    const newSaveStatus: Record<number, 'saving' | 'saved' | null> = {};
    newPageOrder.forEach((origIdx, newIdx) => {
      if (saveStatus[origIdx]) newSaveStatus[newIdx] = saveStatus[origIdx];
    });
    setSaveStatus(newSaveStatus);
  }, [saveStatus]);

  // Add a section header (group) at the end of entries
  const addGroup = useCallback((name: string = 'New Section') => {
    setEntries((prev) => {
      const updated = [...prev, { name, indent: 0, type: 'group' as const }];
      return updated;
    });
    // Immediately save
    setTimeout(() => {
      const currentEntries = entriesRef.current;
      const currentDirty = new Set(dirtyRowsRef.current);
      currentDirty.add(currentEntries.length - 1);
      setDirtyRows(new Set());
      saveEntries(currentEntries, currentDirty);
    }, 50);
  }, [saveEntries]);

  // Remove a group entry by its index in the entries array
  const removeGroup = useCallback((entryIndex: number) => {
    setEntries((prev) => {
      if (prev[entryIndex]?.type !== 'group') return prev;
      const updated = [...prev];
      updated.splice(entryIndex, 1);
      return updated;
    });
    // Immediately save
    setTimeout(() => {
      const currentEntries = entriesRef.current;
      saveEntries(currentEntries, new Set([0]));
    }, 50);
  }, [saveEntries]);

  return {
    entries,
    setEntries,
    pageCount,
    setPageCount,
    saveStatus,
    syncPageCount,
    updateEntry,
    flushPendingSaves,
    remapSaveStatus,
    addGroup,
    removeGroup,
  };
}