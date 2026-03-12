// components/admin/shared/TextPagesTabEditor.tsx
'use client';

import { Check, Loader2, Plus, Trash2, FileText } from 'lucide-react';
import { useTextPagesEditor } from './useTextPagesEditor';
import TextPageFormPanel from './TextPageFormPanel';

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface TextPagesTabEditorProps {
  apiBase: string;
  entityKey: string;
  entityId: string;
  companyId: string | null;
  extraPostFields?: Record<string, unknown>;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function TextPagesTabEditor({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields = {},
}: TextPagesTabEditorProps) {
  const {
    pages, selectedId, setSelectedId,
    form, updateForm, saveStatus,
    adding, loaded, addPage, deletePage,
  } = useTextPagesEditor({ apiBase, entityKey, entityId, extraPostFields });

  /* ── Loading ───────────────────────────────────────────────────────────── */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

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
                ? 'bg-teal/10 border-teal/30 text-teal'
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
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-teal border border-dashed border-teal/30 hover:bg-teal/5 transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Add Page
        </button>
      </div>

      {/* ── Editor ────────────────────────────────────────────── */}
      {selectedId && form ? (
        <TextPageFormPanel
          form={form}
          companyId={companyId}
          onUpdate={updateForm}
        />
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
