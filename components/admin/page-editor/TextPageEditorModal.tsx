// components/admin/page-editor/TextPageEditorModal.tsx
'use client';

import { useCallback, useEffect } from 'react';
import { X, FileText, Check, Loader2 } from 'lucide-react';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import { TextPageData } from './useTextPagesState';

interface TextPageEditorModalProps {
  page: TextPageData;
  saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (pageId: string, changes: Partial<TextPageData>) => void;
  onClose: () => void;
}

export default function TextPageEditorModal({
  page,
  saveStatus,
  onUpdate,
  onClose,
}: TextPageEditorModalProps) {
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(page.id, { title: e.target.value });
    },
    [page.id, onUpdate],
  );

  const handleContentChange = useCallback(
    (content: unknown) => {
      onUpdate(page.id, { content });
    },
    [page.id, onUpdate],
  );

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] mx-4 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <FileText size={16} className="text-purple-600" />
              Edit Text Page
            </span>
            {/* Save status */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <Check size={12} />
                Saved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Page title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Page Title</label>
            <input
              type="text"
              value={page.title}
              onChange={handleTitleChange}
              placeholder="e.g. Executive Summary, Welcome, Terms & Conditions"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#017C87] focus:ring-1 focus:ring-[#017C87]/20"
            />
          </div>

          {/* Rich text editor */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
            <RichTextEditor
              content={page.content}
              onUpdate={handleContentChange}
              placeholder="Start writing your content... Use the Fields button to insert dynamic fields like {Client Name}."
            />
          </div>

          {/* Hint */}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            💡 Use the <strong>Fields</strong> button in the toolbar to insert dynamic fields that auto-populate with client/company information in the viewer.
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#017C87] hover:bg-[#015F68] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}