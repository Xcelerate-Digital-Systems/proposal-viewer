// components/admin/shared/TextPageFormPanel.tsx
'use client';

import { User, Image } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import RichTextEditor from '@/components/admin/text-editor/RichTextEditor';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
import type { TextPageForm } from './useTextPagesEditor';

interface TextPageFormPanelProps {
  form: TextPageForm;
  companyId: string | null;
  onUpdate: (changes: Partial<TextPageForm>) => void;
}

export default function TextPageFormPanel({ form, companyId, onUpdate }: TextPageFormPanelProps) {
  return (
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
          onChange={() => onUpdate({ enabled: !form.enabled })}
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
                  onClick={() => onUpdate({ show_title: !form.show_title })}
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
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="e.g. Executive Summary, Welcome, Terms & Conditions"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#017C87] focus:ring-1 focus:ring-[#017C87]/20"
            />
          </div>

          {/* Member badge + Client logo — side by side */}
          <div className="grid grid-cols-2 gap-4">

            {/* Member badge card */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">
                    Show Avatar
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!form.show_member_badge}
                  onClick={() =>
                    onUpdate({
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
                    onSelect={(id) => onUpdate({ prepared_by_member_id: id })}
                  />
                </div>
              )}

              {form.show_member_badge && !companyId && (
                <p className="text-[10px] text-gray-400">
                  Company context required to select a team member.
                </p>
              )}
            </div>

            {/* Client logo card */}
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
                  onClick={() => onUpdate({ show_client_logo: !form.show_client_logo })}
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

          </div>

          {/* Rich text editor */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              CONTENT
            </label>
            <RichTextEditor
              content={form.content}
              onUpdate={(content) => onUpdate({ content })}
              placeholder="Start writing your content... Use the Fields button to insert dynamic fields like {Client Name}."
            />
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
              Use the <strong>Fields</strong> button in the toolbar to insert dynamic
              fields that auto-populate with client/company information in the viewer.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
