// components/admin/shared/TextPageSettingsBar.tsx
'use client';

import { User, Image as ImageIcon } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
import type { TextPageForm } from './useTextPagesEditor';

interface TextPageSettingsBarProps {
  form: TextPageForm;
  companyId: string | null;
  onUpdate: (changes: Partial<TextPageForm>) => void;
}

function MiniSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-teal' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function TextPageSettingsBar({ form, companyId, onUpdate }: TextPageSettingsBarProps) {
  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Page Settings</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Show this page</span>
          <Toggle enabled={form.enabled} onChange={() => onUpdate({ enabled: !form.enabled })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        {/* Title */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-gray-500">Page Title</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">Show in viewer</span>
              <MiniSwitch checked={form.show_title} onChange={() => onUpdate({ show_title: !form.show_title })} />
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

        {/* Avatar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <User size={13} className="text-gray-400" />
              <span className="text-[11px] font-medium text-gray-700">Show Avatar</span>
            </div>
            <MiniSwitch
              checked={!!form.show_member_badge}
              onChange={() => onUpdate({
                show_member_badge: !form.show_member_badge,
                ...(!form.show_member_badge ? {} : { prepared_by_member_id: null }),
              })}
            />
          </div>
          {form.show_member_badge && companyId ? (
            <PreparedBySelector
              companyId={companyId}
              selectedMemberId={form.prepared_by_member_id ?? null}
              onSelect={(id) => onUpdate({ prepared_by_member_id: id })}
            />
          ) : (
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Adds a signature-style member card at the page footer.
            </p>
          )}
        </div>

        {/* Client logo */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <ImageIcon size={13} className="text-gray-400" />
              <span className="text-[11px] font-medium text-gray-700">Show Client Logo</span>
            </div>
            <MiniSwitch
              checked={!!form.show_client_logo}
              onChange={() => onUpdate({ show_client_logo: !form.show_client_logo })}
            />
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Top-right on portrait, side column on landscape.
          </p>
        </div>
      </div>
    </div>
  );
}
