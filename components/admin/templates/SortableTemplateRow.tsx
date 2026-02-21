// components/admin/templates/SortableTemplateRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, ArrowLeft, CornerDownRight, ChevronDown,
  Upload, Trash2, Plus, Loader2, Check,
} from 'lucide-react';

const PRESET_LABELS = [
  'INTRODUCTION', 'TABLE OF CONTENTS', 'EXECUTIVE SUMMARY', 'WHO ARE WE',
  'ABOUT US', 'OUR APPROACH', 'YOUR SOLUTION', 'SERVICES', 'SCOPE OF WORK',
  'HOW WE GET RESULTS', 'METHODOLOGY', 'DELIVERABLES', 'CASE STUDIES',
  'CASE STUDY', 'TESTIMONIALS', 'YOUR INVESTMENT', 'PRICING', 'TIMELINE',
  'FAQ', 'TERMS & CONDITIONS', 'NEXT STEPS', 'CONTACT', 'APPENDIX',
];

const CUSTOM_VALUE = '__custom__';

interface SortableTemplateRowProps {
  id: string;
  label: string;
  indent: number;
  visualNum: number;
  isSelected: boolean;
  isDropdownOpen: boolean;
  status: 'saving' | 'saved' | null;
  processing: boolean;
  index: number;
  onSelect: () => void;
  onToggleIndent: () => void;
  onLabelChange: (label: string) => void;
  onOpenDropdown: (open: boolean) => void;
  onSelectPreset: (label: string) => void;
  onReplacePage: (file: File) => void;
  onDeletePage: () => void;
  onInsertAfter: (file: File) => void;
}

export default function SortableTemplateRow({
  id,
  label,
  indent,
  visualNum,
  isSelected,
  isDropdownOpen,
  status,
  processing,
  index,
  onSelect,
  onToggleIndent,
  onLabelChange,
  onOpenDropdown,
  onSelectPreset,
  onReplacePage,
  onDeletePage,
  onInsertAfter,
}: SortableTemplateRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isCustom = !PRESET_LABELS.includes(label.toUpperCase());

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg px-1.5 py-1 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#017C87]/10 ring-1 ring-[#017C87]/30'
            : 'hover:bg-gray-100'
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

        {/* Page number */}
        <span className="text-xs text-gray-400 w-5 text-right shrink-0">
          {visualNum}.
        </span>

        {/* Indent toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleIndent(); }}
          disabled={index === 0}
          title={indent ? 'Remove indent' : 'Indent under parent'}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors ${
            index === 0
              ? 'text-gray-200 cursor-not-allowed'
              : indent
              ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          {indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
        </button>

        {indent > 0 && (
          <span className="text-[10px] text-[#017C87]/50 shrink-0">SUB</span>
        )}

        {/* Label: dropdown or custom input */}
        <div className="flex-1 relative min-w-0" onClick={(e) => e.stopPropagation()}>
          {isCustom ? (
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-l-md border border-r-0 border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-[#017C87]/40 placeholder:text-gray-400"
                placeholder="Custom label..."
              />
              <button
                onClick={() => onOpenDropdown(!isDropdownOpen)}
                className="px-2 py-1.5 rounded-r-md border border-gray-200 bg-white text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronDown size={13} className={isDropdownOpen ? 'rotate-180' : ''} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenDropdown(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-900 text-sm hover:border-gray-300 transition-colors"
            >
              <span className="truncate">{label}</span>
              <ChevronDown size={13} className={`text-gray-400 shrink-0 ml-1 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {isDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {PRESET_LABELS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => onSelectPreset(preset)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-100 last:border-0 ${
                    label === preset
                      ? 'text-[#017C87] bg-[#017C87]/5'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                onClick={() => onSelectPreset(CUSTOM_VALUE)}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors italic"
              >
                Custom...
              </button>
            </div>
          )}
        </div>

        {/* Autosave status */}
        <div className="shrink-0 w-5 flex items-center justify-center">
          {status === 'saving' && <Loader2 size={12} className="animate-spin text-gray-300" />}
          {status === 'saved' && <Check size={13} className="text-emerald-400" />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <label
            className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Replace page PDF"
          >
            <Upload size={12} />
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplacePage(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={onDeletePage}
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete page"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Insert after */}
      <div className="flex items-center justify-center py-0.5">
        <label
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
            processing
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-300 hover:text-[#017C87] hover:bg-[#017C87]/5 cursor-pointer'
          }`}
        >
          <Plus size={10} />
          Insert after
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            disabled={processing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onInsertAfter(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}