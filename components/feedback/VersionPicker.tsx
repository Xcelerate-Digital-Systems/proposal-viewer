'use client';

import { Plus, History } from 'lucide-react';
import type { VersionView } from '@/lib/feedback/versions';

interface VersionPickerProps {
  versions: VersionView[];
  activeVersionId: string | null;
  onChange: (versionId: string | null) => void;
  /** If omitted, the "+" button is hidden — used on the public/client side. */
  onAddVersion?: () => void;
  compact?: boolean;
}

/**
 * Segmented v1 · v2 · v3 picker. Always renders at least the v1 pill so
 * reviewers see which version they're looking at; the "+" button only
 * shows when callers (admin) opt in via onAddVersion.
 */
export default function VersionPicker({
  versions, activeVersionId, onChange, onAddVersion, compact = false,
}: VersionPickerProps) {
  if (!versions.length) return null;

  const active = versions.find((v) => (v.id ?? null) === activeVersionId) || versions[0];

  return (
    <div className="flex items-center gap-1">
      <div
        className={`inline-flex items-center gap-0.5 rounded-full bg-gray-50 ${
          compact ? 'p-0.5' : 'p-1'
        }`}
        title="Select version"
      >
        <History size={compact ? 12 : 13} className="text-gray-400 ml-1 shrink-0" />
        {versions.map((v) => {
          const isActive = (v.id ?? null) === (active.id ?? null);
          return (
            <button
              key={v.id ?? 'v1'}
              onClick={() => onChange(v.id)}
              className={`${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-[12px]'} font-semibold rounded-full transition-colors tabular-nums ${
                isActive
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={v.notes || `Version ${v.versionNumber}`}
            >
              v{v.versionNumber}
            </button>
          );
        })}
      </div>

      {onAddVersion && (
        <button
          onClick={onAddVersion}
          className={`${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'} inline-flex items-center gap-1 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-medium transition-colors`}
          title="Upload a new version"
        >
          <Plus size={compact ? 11 : 12} />
          Version
        </button>
      )}
    </div>
  );
}
