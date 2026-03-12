// components/admin/page-editor/TextPageEditorModal.tsx
'use client';

import { useCallback, useEffect } from 'react';
import { X, FileText, Check, Loader2, User, Image } from 'lucide-react';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import { TextPageData } from './pageEditorTypes';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';

interface TextPageEditorModalProps {
  page: TextPageData;
  saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (pageId: string, changes: Partial<TextPageData>) => void;
  onClose: () => void;
  /** Company ID for the PreparedBySelector team member lookup */
  companyId?: string;
}

export default function TextPageEditorModal({
  page,
  saveStatus,
  onUpdate,
  onClose,
  companyId,
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

  const handleToggleBadge = useCallback(() => {
    const newValue = !page.show_member_badge;
    onUpdate(page.id, {
      show_member_badge: newValue,
      // Clear member selection when disabling
      ...(!newValue ? { prepared_by_member_id: null } : {}),
    });
  }, [page.id, page.show_member_badge, onUpdate]);

  const handleToggleClientLogo = useCallback(() => {
    onUpdate(page.id, { show_client_logo: !page.show_client_logo });
  }, [page.id, page.show_client_logo, onUpdate]);

  const handleToggleTitle = useCallback(() => {
    onUpdate(page.id, { show_title: !(page.show_title ?? true) });
  }, [page.id, page.show_title, onUpdate]);

  const handleMemberSelect = useCallback(
    (memberId: string | null) => {
      onUpdate(page.id, { prepared_by_member_id: memberId });
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Page Title</label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Show on page</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={page.show_title ?? true}
                  onClick={handleToggleTitle}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal/20 ${
                    (page.show_title ?? true) ? 'bg-teal' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                      (page.show_title ?? true) ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={page.title}
              onChange={handleTitleChange}
              placeholder="e.g. Executive Summary, Welcome, Terms & Conditions"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20"
            />
          </div>

          {/* Member badge toggle */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-700">Show Member Badge</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!page.show_member_badge}
                onClick={handleToggleBadge}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal/20 ${
                  page.show_member_badge ? 'bg-teal' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                    page.show_member_badge ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Member selector — visible when badge is enabled */}
            {page.show_member_badge && companyId && (
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1">Team Member</label>
                <PreparedBySelector
                  companyId={companyId}
                  selectedMemberId={page.prepared_by_member_id || null}
                  onSelect={handleMemberSelect}
                />
              </div>
            )}

            {page.show_member_badge && !companyId && (
              <p className="text-[10px] text-gray-400">
                Save and reopen this page to select a team member.
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
                aria-checked={!!page.show_client_logo}
                onClick={handleToggleClientLogo}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal/20 ${
                  page.show_client_logo ? 'bg-teal' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                    page.show_client_logo ? 'translate-x-4' : 'translate-x-0'
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
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal hover:bg-[#015F68] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}