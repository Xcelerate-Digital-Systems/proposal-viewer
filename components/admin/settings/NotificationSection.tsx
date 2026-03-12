// components/admin/settings/NotificationSection.tsx
'use client';

import { Loader2 } from 'lucide-react';
import { type TeamMember } from '@/lib/supabase';
import { type NotificationOption } from './settings-config';

interface NotificationSectionProps {
  title: string;
  options: NotificationOption[];
  teamMember: TeamMember | null;
  saving: string | null;
  onToggle: (key: string) => void;
  accentLabel?: string;
}

export default function NotificationSection({
  title,
  options,
  teamMember,
  saving,
  onToggle,
  accentLabel,
}: NotificationSectionProps) {
  return (
    <div className="bg-white border border-edge rounded-[14px]  overflow-hidden">
      <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {accentLabel && (
          <span className="text-[9px] font-semibold uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded">
            {accentLabel}
          </span>
        )}
      </div>
      <div className="divide-y divide-edge">
        {options.map((opt) => {
          const enabled = !!(teamMember as Record<string, unknown>)?.[opt.key];
          return (
            <div key={opt.key} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <opt.icon size={15} className={enabled ? 'text-teal shrink-0' : 'text-faint shrink-0'} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{opt.label}</p>
                  <p className="text-xs text-faint truncate">{opt.description}</p>
                </div>
              </div>
              <button
                onClick={() => onToggle(opt.key)}
                disabled={saving === opt.key}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  enabled ? 'bg-teal' : 'bg-edge'
                }`}
              >
                {saving === opt.key ? (
                  <Loader2 size={14} className="animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                ) : (
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform absolute top-0.5  ${
                      enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
