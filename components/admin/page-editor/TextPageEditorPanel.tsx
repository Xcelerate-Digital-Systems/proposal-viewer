// components/admin/page-editor/TextPageEditorPanel.tsx
'use client';

import { useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText, Check, Loader2 } from 'lucide-react';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import { TextPageData } from './pageEditorTypes';

interface TextPageEditorPanelProps {
  page: TextPageData;
  saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (pageId: string, changes: Partial<TextPageData>) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function TextPageEditorPanel({
  page,
  saveStatus,
  onUpdate,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
}: TextPageEditorPanelProps) {
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(page.id, { title: e.target.value });
  }, [page.id, onUpdate]);

  const handleContentChange = useCallback((content: unknown) => {
    onUpdate(page.id, { content });
  }, [page.id, onUpdate]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-white min-h-0">
        {/* Header bar */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onGoPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-500 font-medium">Text Page</span>
            <button
              onClick={onGoNext}
              disabled={!canGoNext}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Loader2 size={10} className="animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-[10px] text-green-500">
                <Check size={10} />
                Saved
              </span>
            )}
            <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
              <FileText size={11} />
              {page.title || 'Text Page'}
            </span>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
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
      </div>
    </div>
  );
}