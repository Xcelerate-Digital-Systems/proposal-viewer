// components/admin/shared/useTextPagesEditor.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface RawPage {
  id: string;
  entity_id: string;
  type: string;
  title: string;
  enabled: boolean;
  position: number;
  show_title?: boolean;
  show_member_badge?: boolean;
  show_client_logo?: boolean;
  prepared_by_member_id?: string | null;
  payload: Record<string, unknown>;
}

export interface TextPageForm {
  title: string;
  content: unknown;
  enabled: boolean;
  show_title: boolean;
  show_member_badge: boolean;
  show_client_logo: boolean;
  prepared_by_member_id: string | null;
}

export interface TextPageRecord {
  id: string;
  title: string;
  content: unknown;
  enabled: boolean;
  show_title: boolean;
  show_member_badge: boolean;
  show_client_logo: boolean;
  prepared_by_member_id: string | null;
  position: number;
}

export interface UseTextPagesEditorOptions {
  apiBase: string;
  entityKey: string;
  entityId: string;
  extraPostFields?: Record<string, unknown>;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function rawToRecord(page: RawPage): TextPageRecord {
  return {
    id:                    page.id,
    title:                 page.title,
    content:               page.payload?.content ?? null,
    enabled:               page.enabled,
    show_title:            page.show_title ?? true,
    show_member_badge:     page.show_member_badge ?? false,
    show_client_logo:      page.show_client_logo ?? false,
    prepared_by_member_id: page.prepared_by_member_id ?? null,
    position:              page.position,
  };
}

export function recordToForm(record: TextPageRecord): TextPageForm {
  return {
    title:                 record.title,
    content:               record.content,
    enabled:               record.enabled,
    show_title:            record.show_title,
    show_member_badge:     record.show_member_badge,
    show_client_logo:      record.show_client_logo,
    prepared_by_member_id: record.prepared_by_member_id,
  };
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export function useTextPagesEditor({
  apiBase,
  entityKey,
  entityId,
  extraPostFields = {},
}: UseTextPagesEditorOptions) {
  const toast = useToast();

  const [pages, setPages]           = useState<TextPageRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm]             = useState<TextPageForm | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [adding, setAdding]         = useState(false);
  const [loaded, setLoaded]         = useState(false);

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestForm  = useRef<TextPageForm | null>(null);
  const selectedRef = useRef<string | null>(null);

  latestForm.current  = form;
  selectedRef.current = selectedId;

  /* ── Load pages ──────────────────────────────────────────────── */

  const loadPages = useCallback(async () => {
    const res = await fetch(`${apiBase}?${entityKey}=${entityId}`);
    if (!res.ok) return;
    const data: RawPage[] = await res.json();
    const textPages = data
      .filter((p) => p.type === 'text')
      .map(rawToRecord)
      .sort((a, b) => a.position - b.position);

    setPages(textPages);
    setLoaded(true);

    setSelectedId((prev) => {
      if (prev && textPages.find((p) => p.id === prev)) return prev;
      return textPages[0]?.id ?? null;
    });
  }, [apiBase, entityKey, entityId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Cancel pending save on page switch
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Sync form when selected page changes
  useEffect(() => {
    setPages((currentPages) => {
      const page = currentPages.find((p) => p.id === selectedId);
      if (page) {
        setForm(recordToForm(page));
      } else {
        setForm(null);
      }
      return currentPages;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ── Autosave ────────────────────────────────────────────────── */

  const flushSave = useCallback(async (pageId: string, data: TextPageForm) => {
    setSaveStatus('saving');
    const { content, ...rest } = data;
    await fetch(`${apiBase}?id=${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:                 rest.title,
        enabled:               rest.enabled,
        show_title:            rest.show_title,
        show_member_badge:     rest.show_member_badge,
        show_client_logo:      rest.show_client_logo,
        prepared_by_member_id: rest.prepared_by_member_id,
        payload_patch:         { content },
      }),
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [apiBase]);

  const scheduleSave = useCallback((pageId: string, data: TextPageForm) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushSave(pageId, data);
    }, 800);
  }, [flushSave]);

  /* ── Update form field ───────────────────────────────────────── */

  const updateForm = useCallback((changes: Partial<TextPageForm>) => {
    if (!selectedRef.current) return;
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      scheduleSave(selectedRef.current!, next);
      return next;
    });
    if ('title' in changes || 'enabled' in changes) {
      setPages((prev) =>
        prev.map((p) =>
          p.id === selectedRef.current ? { ...p, ...changes } : p,
        ),
      );
    }
  }, [scheduleSave]);

  /* ── Add page ────────────────────────────────────────────────── */

  const addPage = useCallback(async () => {
    setAdding(true);
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [entityKey]: entityId,
        type:    'text',
        title:   'New Text Page',
        enabled: true,
        ...extraPostFields,
      }),
    });
    if (res.ok) {
      await loadPages();
      const data: RawPage = await res.json().catch(() => null);
      if (data?.id) setSelectedId(data.id);
    } else {
      toast.error('Failed to add text page');
    }
    setAdding(false);
  }, [apiBase, entityKey, entityId, extraPostFields, loadPages, toast]);

  /* ── Delete page ─────────────────────────────────────────────── */

  const deletePage = useCallback(async (pageId: string) => {
    const res = await fetch(apiBase, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [entityKey]: entityId, page_id: pageId }),
    });
    if (res.ok) {
      setPages((prev) => {
        const next = prev.filter((p) => p.id !== pageId);
        if (selectedId === pageId) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
    } else {
      toast.error('Failed to delete page');
    }
  }, [apiBase, entityKey, entityId, selectedId, toast]);

  return {
    pages,
    selectedId,
    setSelectedId,
    form,
    updateForm,
    saveStatus,
    adding,
    loaded,
    addPage,
    deletePage,
  };
}
