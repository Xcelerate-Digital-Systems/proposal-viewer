// components/admin/templates/useTemplatePageState.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, TemplatePage } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

const CUSTOM_VALUE = '__custom__';

export function useTemplatePageState(templateId: string) {
  const toast = useToast();

  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [localEdits, setLocalEdits] = useState<Record<string, { label: string; indent: number }>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | null>>({});

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const localEditsRef = useRef(localEdits);
  localEditsRef.current = localEdits;

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
      Object.values(savedTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Fetch pages
  const fetchPages = useCallback(async () => {
    const { data } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', templateId)
      .order('page_number', { ascending: true });

    const templatePages = (data || []) as TemplatePage[];
    setPages(templatePages);

    const edits: Record<string, { label: string; indent: number }> = {};
    for (const p of templatePages) {
      edits[p.id] = { label: p.label, indent: p.indent ?? 0 };
    }
    setLocalEdits(edits);

    const urls: Record<string, string> = {};
    for (const page of templatePages) {
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(page.file_path, 3600);
      if (urlData?.signedUrl) urls[page.id] = urlData.signedUrl;
    }
    setPageUrls(urls);
    setLoading(false);
  }, [templateId]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // Save a single page edit
  const savePageEdit = useCallback(async (pageId: string, label: string, indent: number) => {
    setSaveStatus((prev) => ({ ...prev, [pageId]: 'saving' }));
    try {
      await supabase.from('template_pages').update({ label, indent }).eq('id', pageId);
      setSaveStatus((prev) => ({ ...prev, [pageId]: 'saved' }));
      if (savedTimers.current[pageId]) clearTimeout(savedTimers.current[pageId]);
      savedTimers.current[pageId] = setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [pageId]: null }));
      }, 2000);
    } catch {
      toast.error('Failed to save');
      setSaveStatus((prev) => ({ ...prev, [pageId]: null }));
    }
  }, [toast]);

  // Flush all pending debounced saves
  const flushPendingSaves = useCallback(async () => {
    const promises: Promise<void>[] = [];
    for (const [pageId, timer] of Object.entries(debounceTimers.current)) {
      clearTimeout(timer);
      const edit = localEditsRef.current[pageId];
      if (edit) promises.push(savePageEdit(pageId, edit.label, edit.indent));
    }
    debounceTimers.current = {};
    if (promises.length > 0) await Promise.all(promises);
  }, [savePageEdit]);

  const getEdit = (pageId: string) =>
    localEdits[pageId] ?? { label: '', indent: 0 };

  const updateEdit = (pageId: string, changes: Partial<{ label: string; indent: number }>) => {
    const updated = { ...getEdit(pageId), ...changes };
    setLocalEdits((prev) => ({ ...prev, [pageId]: updated }));

    if (debounceTimers.current[pageId]) clearTimeout(debounceTimers.current[pageId]);
    const delay = changes.indent !== undefined ? 0 : 800;
    debounceTimers.current[pageId] = setTimeout(() => {
      savePageEdit(pageId, updated.label, updated.indent);
      delete debounceTimers.current[pageId];
    }, delay);
  };

  const selectPreset = (pageId: string, label: string, setOpenDropdown: (v: string | null) => void) => {
    if (label !== CUSTOM_VALUE) updateEdit(pageId, { label });
    setOpenDropdown(null);
  };

  const toggleIndent = (pageId: string, pageIndex: number) => {
    if (pageIndex === 0) return;
    const current = getEdit(pageId);
    updateEdit(pageId, { indent: current.indent === 0 ? 1 : 0 });
  };

  return {
    pages, setPages, pageUrls, loading, localEdits, setLocalEdits,
    saveStatus, fetchPages, flushPendingSaves,
    getEdit, updateEdit, selectPreset, toggleIndent,
  };
}