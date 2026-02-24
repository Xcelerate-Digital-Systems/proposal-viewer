// components/admin/page-editor/SortablePdfRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check, CornerDownRight, ArrowLeft,
  Upload, Loader2, Trash2, GripVertical,
} from 'lucide-react';
import { PageNameEntry } from '@/lib/supabase';
import PageLinkInput from './PageLinkInput';

interface SortablePdfRowProps {
  id: string;
  entry: PageNameEntry;
  visualNum: number;
  isSelected: boolean;
  status: 'saving' | 'saved' | null;
  processing: boolean;
  pageCount: number;
  index: number;
  onSelect: () => void;
  onToggleIndent: () => void;
  onUpdateEntry: (changes: Partial<PageNameEntry>) => void;
  onReplacePage: (file: File) => void;
  onDeletePage: () => void;
}

export default function SortablePdfRow({
  id, entry, visualNum, isSelected,
  status, processing, pageCount, index,
  onSelect, onToggleIndent, onUpdateEntry,
  onReplacePage, onDeletePage,
}: SortablePdfRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
          isSelected ? 'bg-[#017C87]/10 ring-1 ring-[#017C87]/30' : 'hover:bg-gray-100'
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>

        <span className="text-xs text-gray-400 w-5 text-right shrink-0 font-medium">{visualNum}.</span>

        {/* Indent toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleIndent(); }}
          disabled={index === 0}
          title={entry.indent ? 'Remove indent' : 'Indent under parent'}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors ${
            index === 0
              ? 'text-gray-200 cursor-not-allowed'
              : entry.indent
              ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          {entry.indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
        </button>

        {entry.indent > 0 && <span className="text-[10px] text-[#017C87]/50 shrink-0">SUB</span>}

        {/* Label */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={entry.name}
            onChange={(e) => onUpdateEntry({ name: e.target.value })}
            onFocus={onSelect}
            className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-[#017C87]/40 placeholder:text-gray-400"
            placeholder={`Page ${visualNum}`}
          />
        </div>

        {/* Autosave status */}
        <div className="shrink-0 w-5 flex items-center justify-center">
          {status === 'saving' && <Loader2 size={12} className="animate-spin text-gray-300" />}
          {status === 'saved' && <Check size={13} className="text-emerald-400" />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <PageLinkInput
            linkUrl={entry.link_url || ''}
            linkLabel={entry.link_label || ''}
            onChange={(url, label) => onUpdateEntry({ link_url: url || undefined, link_label: label || undefined })}
            variant="teal"
          />
          <label
            className={`p-1.5 rounded-md flex items-center justify-center border transition-colors ${
              processing
                ? 'text-gray-200 border-gray-100 cursor-not-allowed'
                : 'text-[#017C87] border-[#017C87]/25 hover:bg-[#017C87]/5 hover:border-[#017C87]/40 cursor-pointer'
            }`}
            title="Replace page PDF"
          >
            <Upload size={13} />
            <input type="file" accept=".pdf" className="hidden" disabled={processing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplacePage(f); e.target.value = ''; }}
            />
          </label>
          <button
            onClick={onDeletePage}
            disabled={processing || pageCount <= 1}
            className={`p-1.5 rounded-md flex items-center justify-center border transition-colors ${
              processing || pageCount <= 1
                ? 'text-gray-200 border-gray-100 cursor-not-allowed'
                : 'text-[#017C87] border-[#017C87]/25 hover:text-red-500 hover:bg-red-50 hover:border-red-200'
            }`}
            title="Delete page"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}