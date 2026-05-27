// components/admin/shared/TextPageSettingsCard.tsx
// Inline settings card for a text page — mirrors the PricingSettings/PackagesAppearance
// pattern so the Text Pages tab has the same chrome as Quotes.
'use client';

import { User, Image as ImageIcon } from 'lucide-react';
import PreparedBySelector from '@/components/admin/shared/PreparedBySelector';
import type { TextPageForm } from './useTextPagesEditor';

interface TextPageSettingsCardProps {
  form: TextPageForm;
  companyId: string | null;
  onUpdate: (changes: Partial<TextPageForm>) => void;
}

const INPUT_CLS =
  'w-full px-3 py-2.5 rounded-lg border border-edge-strong bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-faint';

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-teal' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function TextPageSettingsCard({ form, companyId, onUpdate }: TextPageSettingsCardProps) {
  return (
    <div className="rounded-2xl border border-edge-strong bg-white">
      <div className="px-4 py-3 border-b border-edge">
        <h3 className="text-sm font-semibold text-gray-800">Page Settings</h3>
        <p className="text-xs text-faint mt-0.5">Title, header, and footer options for this page</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Title + show-in-viewer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-prose">Page Title</label>
            <label className="flex items-center gap-2 text-detail text-dim cursor-pointer">
              <span>Show title in viewer</span>
              <Switch
                checked={form.show_title}
                onChange={() => onUpdate({ show_title: !form.show_title })}
              />
            </label>
          </div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="e.g. Executive Summary"
            className={INPUT_CLS}
          />
        </div>

        {/* Two-column row: avatar / client logo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avatar */}
          <div className="rounded-lg border border-edge bg-surface/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User size={14} className="text-faint" />
                <span className="text-xs font-medium text-prose">Show Avatar</span>
              </div>
              <Switch
                checked={!!form.show_member_badge}
                onChange={() =>
                  onUpdate({
                    show_member_badge: !form.show_member_badge,
                    ...(!form.show_member_badge ? {} : { prepared_by_member_id: null }),
                  })
                }
              />
            </div>
            {form.show_member_badge && companyId ? (
              <PreparedBySelector
                companyId={companyId}
                selectedMemberId={form.prepared_by_member_id ?? null}
                onSelect={(id) => onUpdate({ prepared_by_member_id: id })}
              />
            ) : (
              <p className="text-detail text-faint leading-relaxed">
                Adds a signature-style member card at the page footer.
              </p>
            )}
          </div>

          {/* Client logo */}
          <div className="rounded-lg border border-edge bg-surface/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-faint" />
                <span className="text-xs font-medium text-prose">Show Client Logo</span>
              </div>
              <Switch
                checked={!!form.show_client_logo}
                onChange={() => onUpdate({ show_client_logo: !form.show_client_logo })}
              />
            </div>
            <p className="text-detail text-faint leading-relaxed">
              Top-right on portrait pages, side column on landscape.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
