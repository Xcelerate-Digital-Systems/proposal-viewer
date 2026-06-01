// components/admin/page-editor/useTocSettings.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, parseTocSettings } from '@/lib/supabase';
import type { TocSettings } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { UnifiedPage } from '@/lib/page-operations';
import type { EntityType } from './usePageEditor';

const entityTable = (type: EntityType) =>
  type === 'proposal' ? 'proposals' : type === 'template' ? 'proposal_templates' : 'documents';

export function useTocSettings(entityId: string, entityType: EntityType, pages: UnifiedPage[]) {
  const toast = useToast();
  const [settings, setSettings] = useState<TocSettings>(parseTocSettings(null));
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const table = entityTable(entityType);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from(table).select('toc_settings').eq('id', entityId).single();
      if (data) setSettings(parseTocSettings(data.toc_settings));
      setLoaded(true);
    })();
  }, [entityId, table]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const tocItemIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    let pdfCount = 0;
    for (const page of pages) {
      if (page.type === 'toc') continue;
      if (page.type === 'pdf') { pdfCount++; map[page.id] = `pdf:${pdfCount}`; }
      else if (page.type === 'pricing')  map[page.id] = 'pricing';
      else if (page.type === 'packages') map[page.id] = `packages:${page.id}`;
      else if (page.type === 'text')     map[page.id] = `text:${page.id}`;
      else if (page.type === 'section')  map[page.id] = `group:${page.title}`;
    }
    return map;
  }, [pages]);

  const tocExists = useMemo(() => pages.some(p => p.type === 'toc'), [pages]);
  const prevTocRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (prevTocRef.current === null) { prevTocRef.current = tocExists; return; }
    if (prevTocRef.current !== tocExists) {
      prevTocRef.current = tocExists;
      const next = { ...settingsRef.current, enabled: tocExists };
      setSettings(next);
      supabase.from(table).update({ toc_settings: next }).eq('id', entityId);
    }
  }, [tocExists, loaded, entityId, table]);

  const save = useCallback(async (s: TocSettings) => {
    const { error } = await supabase.from(table).update({ toc_settings: s }).eq('id', entityId);
    if (error) toast.error('Failed to save contents settings');
  }, [entityId, table, toast]);

  const scheduleSave = useCallback((s: TocSettings) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { save(s); debounceRef.current = null; }, 800);
  }, [save]);

  const isTocIncluded = useCallback((pageId: string): boolean => {
    const tocId = tocItemIdMap[pageId];
    return tocId ? !settings.excluded_items.includes(tocId) : false;
  }, [tocItemIdMap, settings.excluded_items]);

  const toggleTocInclude = useCallback((pageId: string) => {
    const tocId = tocItemIdMap[pageId];
    if (!tocId) return;
    setSettings(prev => {
      const excluded = new Set(prev.excluded_items);
      if (excluded.has(tocId)) excluded.delete(tocId); else excluded.add(tocId);
      const next = { ...prev, excluded_items: Array.from(excluded) };
      scheduleSave(next);
      return next;
    });
  }, [tocItemIdMap, scheduleSave]);

  const updateTocSettings = useCallback((changes: Partial<TocSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...changes };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  return { tocSettings: settings, tocLoaded: loaded, tocExists, isTocIncluded, toggleTocInclude, updateTocSettings };
}
