// components/admin/shared/BuilderPageStrip.tsx
// Horizontal "page tabs + Add Page + Preview toggle" strip shared by the
// Packages / Text Pages / Pricing tab editors. Each of those used to roll its
// own copy; consolidating here keeps the visual treatment identical and
// drops ~40 lines of duplication per consumer.
'use client';

import { Loader2, Plus, Trash2, Eye, type LucideIcon } from 'lucide-react';

export interface BuilderPageStripItem {
  id: string;
  title: string;
  enabled: boolean;
}

interface BuilderPageStripProps {
  pages: BuilderPageStripItem[];
  selectedId: string | null;
  onSelect: (page: BuilderPageStripItem) => void;
  onDelete: (pageId: string) => void;
  onAdd: () => void;
  adding?: boolean;
  /** Icon shown beside each page label (DollarSign / Package / FileText etc.). */
  icon: LucideIcon;
  /** Render the Preview toggle on the right. Omit when the consumer doesn't
   *  have a preview pane (e.g. the line-items only quote view). */
  previewVisible?: boolean;
  onTogglePreview?: () => void;
}

export default function BuilderPageStrip({
  pages,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
  adding,
  icon: Icon,
  previewVisible,
  onTogglePreview,
}: BuilderPageStripProps) {
  return (
    <div className="flex items-end gap-0 border-b border-gray-200 overflow-x-auto">
      {pages.map((page) => {
        const active = selectedId === page.id;
        return (
          <button
            key={page.id}
            onClick={() => onSelect(page)}
            className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              active
                ? 'text-teal border-b-2 border-teal -mb-px bg-teal/5'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent -mb-px'
            }`}
          >
            <Icon size={13} className="shrink-0 opacity-70" />
            <span className="truncate max-w-[160px]">{page.title || 'Untitled'}</span>
            {!page.enabled && <span className="text-[10px] opacity-40 ml-0.5">(off)</span>}
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
            >
              <Trash2 size={11} />
            </span>
          </button>
        );
      })}

      {pages.length === 0 && (
        <span className="px-4 py-2.5 text-xs text-gray-400">No pages yet — add one to get started</span>
      )}

      <button
        onClick={onAdd}
        disabled={adding}
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/5 transition-colors disabled:opacity-50 shrink-0 border-b-2 border-transparent -mb-px"
      >
        {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Add Page
      </button>

      {onTogglePreview && selectedId && (
        <div className="ml-auto flex items-center pr-1 pb-1.5">
          <button
            onClick={onTogglePreview}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              previewVisible
                ? 'bg-teal/10 text-teal'
                : 'bg-gray-100 text-gray-400 hover:text-gray-600'
            }`}
          >
            <Eye size={13} /> Preview
          </button>
        </div>
      )}
    </div>
  );
}
