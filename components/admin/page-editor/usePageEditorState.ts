// components/admin/page-editor/usePageEditorState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, PageNameEntry, normalizePageNames } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

export function usePageEditorState(
  proposalId: string,
  initialPageNames: (PageNameEntry | string)[]
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
  const syncPageCount = useCallback((numPages: number) => {
    setPageCount(numPages);
    setEntries((prev) => {
      const updated = [...prev];
      while (updated.length < numPages) updated.push({ name: `Page ${updated.length + 1}`, indent: 0 });
      return updated.slice(0, numPages);
    });
  }, []);

  // Save entries to database
  const saveEntries = useCallback(async (entriesToSave: PageNameEntry[], rowsToMark: Set<number>) => {
    const savingStatus: Record<number, 'saving'> = {};
    rowsToMark.forEach((idx) => { savingStatus[idx] = 'saving'; });
    setSaveStatus((prev) => ({ ...prev, ...savingStatus }));

    try {
      await supabase.from('proposals').update({ page_names: entriesToSave }).eq('id', proposalId);
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
  };
}