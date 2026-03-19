// components/admin/shared/TextPageSettingsSidebar.tsx
'use client';

import { User, Image } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
import type { TextPageForm } from './useTextPagesEditor';

interface TextPageSettingsSidebarProps {
  form: TextPageForm;
  companyId: string | null;
  onUpdate: (changes: Partial<TextPageForm>) => void;
  onClose?: () => void;
}

export default function TextPageSettingsSidebar({
  form,
  companyId,
  onUpdate,
}: TextPageSettingsSidebarProps) {
  return (
    <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-200 shrink-0">
        <span className="text-sm font-semibold text-gray-800">Page Settings</span>
      </div>

      <div className="p-4 space-y-5 flex-1">

        {/* Visibility */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-gray-700">Show this page</p>
            <p className="text-xs text-gray-400 mt-0.5">Toggle visibility in viewer</p>
          </div>
          <Toggle
            enabled={form.enabled}
            onChange={() => onUpdate({ enabled: !form.enabled })}
          />
        </div>

        <div className="border-t border-gray-100" />

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500">Page Title</label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Show in viewer</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.show_title}
                onClick={() => onUpdate({ show_title: !form.show_title })}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  form.show_title ? 'bg-teal' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
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
            placeholder="e.g. Executive Summary"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20"
          />
        </div>

        <div className="border-t border-gray-100" />

        {/* Avatar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-700">Show Avatar</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!form.show_member_badge}
              onClick={() =>
                onUpdate({
                  show_member_badge: !form.show_member_badge,
                  ...(!form.show_member_badge ? {} : { prepared_by_member_id: null }),
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.show_member_badge ? 'bg-teal' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  form.show_member_badge ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {form.show_member_badge && companyId && (
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Team Member</label>
              <PreparedBySelector
                companyId={companyId}
                selectedMemberId={form.prepared_by_member_id ?? null}
                onSelect={(id) => onUpdate({ prepared_by_member_id: id })}
              />
            </div>
          )}
          {form.show_member_badge && !companyId && (
            <p className="text-[10px] text-gray-400">Company context required.</p>
          )}
        </div>

        <div className="border-t border-gray-100" />

        {/* Client logo */}
        <div>
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
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.show_client_logo ? 'bg-teal' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  form.show_client_logo ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
            Appears top-right on portrait pages, side column on landscape.
          </p>
        </div>

      </div>
    </div>
  );
}
