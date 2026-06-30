// app/templates/PageLibraryView.tsx
'use client';

import { useState } from 'react';
import {
  FileText, Type, Image, DollarSign, Package, ListOrdered,
  Check, X, Pencil, Trash2, Upload, Loader2,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import NoResults from '@/components/ui/NoResults';
import type { PageLibraryRow } from './templates-types';

const PAGE_TYPE_ICONS: Record<string, typeof FileText> = {
  text: Type,
  pdf: Image,
  pricing: DollarSign,
  packages: Package,
  toc: ListOrdered,
  section: FileText,
  decision: FileText,
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  pdf: 'PDF',
  pricing: 'Pricing',
  packages: 'Packages',
  toc: 'Table of Contents',
  section: 'Section',
  decision: 'Decision',
};

export default function PageLibraryView({
  pages,
  allCount,
  searchQuery,
  onDelete,
  onRename,
  onReplacePdf,
}: {
  pages: PageLibraryRow[];
  allCount: number;
  searchQuery: string;
  onDelete: (p: PageLibraryRow) => void;
  onRename: (p: PageLibraryRow, newTitle: string) => void;
  onReplacePdf: (p: PageLibraryRow, file: File) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [replacingId, setReplacingId] = useState<string | null>(null);

  if (pages.length === 0 && searchQuery) {
    return <NoResults message={`No saved pages matching "${searchQuery}"`} />;
  }
  if (allCount === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No saved pages yet"
        description="Inside any proposal, quote, or template editor, click the bookmark icon on a page row to save it to your library. Saved pages can be imported into any entity."
      />
    );
  }

  const handleReplace = async (p: PageLibraryRow, file: File) => {
    setReplacingId(p.id);
    try {
      await onReplacePdf(p, file);
    } finally {
      setReplacingId(null);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 stagger-children">
      {pages.map((p) => {
        const Icon = PAGE_TYPE_ICONS[p.type] ?? FileText;
        const typeLabel = PAGE_TYPE_LABELS[p.type] ?? p.type;
        const isEditing = editingId === p.id;
        const isReplacing = replacingId === p.id;

        return (
          <div
            key={p.id}
            className="group relative bg-white rounded-xl border border-edge-strong p-3 hover:shadow-md hover:border-teal/30 transition-all"
          >
            <div className="flex items-start justify-between gap-1.5 mb-1">
              {isEditing ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editValue.trim()) {
                        onRename(p, editValue.trim());
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    aria-label="Page name"
                    maxLength={120}
                    className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-edge bg-surface text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal/20"
                  />
                  <button onClick={() => { if (editValue.trim()) { onRename(p, editValue.trim()); setEditingId(null); } }} className="p-0.5 text-teal"><Check size={12} /></button>
                  <button onClick={() => setEditingId(null)} className="p-0.5 text-faint"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className="shrink-0 w-6 h-6 rounded bg-surface flex items-center justify-center">
                      <Icon size={14} className="text-dim" />
                    </div>
                    <p className="text-xs font-semibold text-ink truncate">
                      {p.label || p.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition shrink-0">
                    {p.type === 'pdf' && (
                      <label
                        className={`p-0.5 text-faint hover:text-teal cursor-pointer ${isReplacing ? 'pointer-events-none' : ''}`}
                        title="Replace PDF"
                      >
                        {isReplacing ? <Loader2 size={11} className="animate-spin text-teal" /> : <Upload size={11} />}
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          disabled={isReplacing}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleReplace(p, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    <button onClick={() => { setEditingId(p.id); setEditValue(p.label || p.title); }} className="p-0.5 text-faint hover:text-teal" title="Rename" aria-label={`Rename ${p.label || p.title}`}><Pencil size={13} /></button>
                    <button onClick={() => onDelete(p)} className="p-0.5 text-faint hover:text-red-500" title="Delete" aria-label={`Delete ${p.label || p.title}`}><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-between text-detail text-faint">
              <span>{typeLabel}</span>
              <span>{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
