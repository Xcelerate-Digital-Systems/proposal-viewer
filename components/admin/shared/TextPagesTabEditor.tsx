// components/admin/shared/TextPagesTabEditor.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, Loader2, Plus, Trash2, FileText, User, Image } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

interface TextPageForm {
  title: string;
  content: unknown;
  enabled: boolean;
  show_title: boolean;
  show_member_badge: boolean;
  show_client_logo: boolean;
  prepared_by_member_id: string | null;
}

interface TextPageRecord {
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

interface TextPagesTabEditorProps {
  /** e.g. /api/proposals/pages */
  apiBase: string;
  /** e.g. proposal_id | template_id | document_id */
  entityKey: string;
  entityId: string;
  companyId: string | null;
  extraPostFields?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function recordToForm(record: TextPageRecord): TextPageForm {
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TextPagesTabEditor({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields = {},
}: TextPagesTabEditorProps) {
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
    const res  = await fetch(`${apiBase}?${entityKey}=${entityId}`);
    if (!res.ok) return;
    const data: RawPage[] = await res.json();
    const textPages = data
      .filter((p) => p.type === 'text')
      .map(rawToRecord)
      .sort((a, b) => a.position - b.position);

    setPages(textPages);
    setLoaded(true);

    // Auto-select first if nothing selected
    setSelectedId((prev) => {
      if (prev && textPages.find((p) => p.id === prev)) return prev;
      return textPages[0]?.id ?? null;
    });
  }, [apiBase, entityKey, entityId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Cancel any pending save when the selected page changes (page switch only).
  // NOTE: intentionally NOT triggered by `pages` changes — that would cancel
  // in-progress title/field saves because updateForm calls setPages to keep
  // nav chips in sync, which would re-trigger this effect and kill the timer.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Sync form when selected page changes.
  // Depends only on selectedId — not on pages — so that typing in a field
  // (which updates pages for nav chip sync) does not reset the form mid-edit.
  useEffect(() => {
    setPages((currentPages) => {
      const page = currentPages.find((p) => p.id === selectedId);
      if (page) {
        setForm(recordToForm(page));
      } else {
        setForm(null);
      }
      return currentPages; // no-op on pages state
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
    // Also update pages list for title / enabled changes (keeps nav chips in sync)
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

  /* ── Derived ─────────────────────────────────────────────────── */

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null;

  /* ── Render ──────────────────────────────────────────────────── */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Text Pages</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {pages.length === 0
              ? 'No text pages yet'
              : `${pages.filter((p) => p.enabled).length} of ${pages.length} enabled`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <Loader2 size={14} className="animate-spin text-gray-300" />
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* ── Page navigation chips ──────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => setSelectedId(page.id)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${
              selectedId === page.id
                ? 'bg-[#017C87]/10 border-[#017C87]/30 text-[#017C87]'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText size={11} className="shrink-0 opacity-60" />
            <span className="truncate max-w-[140px]">{page.title || 'Untitled'}</span>
            {!page.enabled && (
              <span className="text-[10px] opacity-50 ml-0.5">(off)</span>
            )}
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
              className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
            >
              <Trash2 size={10} />
            </span>
          </button>
        ))}

        {pages.length === 0 && (
          <span className="text-xs text-gray-400">
            No text pages yet — add one to get started
          </span>
        )}

        <button
          onClick={addPage}
          disabled={adding}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Add Page
        </button>
      </div>

      {/* ── Editor ────────────────────────────────────────────── */}
      {selectedId && form ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5">

          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
            <div>
              <p className="text-sm font-medium text-gray-700">Show this page</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Toggle visibility in the viewer
              </p>
            </div>
            <Toggle
              enabled={form.enabled}
              onChange={() => updateForm({ enabled: !form.enabled })}
            />
          </div>

          {form.enabled && (
            <div className="space-y-5 p-4 rounded-xl border border-gray-200 bg-white">

              {/* Page title + show title toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-500">
                    Page Title
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">Show title in viewer</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.show_title}
                      onClick={() => updateForm({ show_title: !form.show_title })}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 ${
                        form.show_title ? 'bg-[#017C87]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                          form.show_title ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  placeholder="e.g. Executive Summary, Welcome, Terms & Conditions"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#017C87] focus:ring-1 focus:ring-[#017C87]/20"
                />
              </div>

              {/* Member badge section */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">
                      Show Member Badge
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!form.show_member_badge}
                    onClick={() =>
                      updateForm({
                        show_member_badge:     !form.show_member_badge,
                        ...(!form.show_member_badge ? {} : { prepared_by_member_id: null }),
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 ${
                      form.show_member_badge ? 'bg-[#017C87]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                        form.show_member_badge ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {form.show_member_badge && companyId && (
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Team Member
                    </label>
                    <PreparedBySelector
                      companyId={companyId}
                      selectedMemberId={form.prepared_by_member_id ?? null}
                      onSelect={(id) => updateForm({ prepared_by_member_id: id })}
                    />
                  </div>
                )}

                {form.show_member_badge && !companyId && (
                  <p className="text-[10px] text-gray-400">
                    Company context required to select a team member.
                  </p>
                )}
              </div>

              {/* Client logo toggle */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image size={14} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">Show Client Logo</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!form.show_client_logo}
                    onClick={() => updateForm({ show_client_logo: !form.show_client_logo })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 ${
                      form.show_client_logo ? 'bg-[#017C87]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                        form.show_client_logo ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Displays the client logo. Appears top-right on portrait pages, side column on landscape pages.
                </p>
              </div>

              {/* Rich text editor */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  CONTENT
                </label>
                <RichTextEditor
                  content={form.content}
                  onUpdate={(content) => updateForm({ content })}
                  placeholder="Start writing your content... Use the Fields button to insert dynamic fields like {Client Name}."
                />
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                  💡 Use the <strong>Fields</strong> button in the toolbar to insert dynamic
                  fields that auto-populate with client/company information in the viewer.
                </p>
              </div>

            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText size={28} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 mb-1">No text page selected</p>
            <p className="text-xs text-gray-300">
              Select a page from the list or add a new one
            </p>
          </div>
        </div>
      )}
    </div>
  );
}