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
 * Segmented v1 · v2 · v3 picker. Single-version items render nothing so we
 * don't clutter the header with a degenerate control; callers still get the
 * "+" button when they want to introduce a v2.
 */
export default function VersionPicker({
  versions, activeVersionId, onChange, onAddVersion, compact = false,
}: VersionPickerProps) {
  if (!versions.length) return null;

  // Hide the picker entirely when a single-version item can't be bumped (e.g. webpage).
  if (versions.length === 1 && !onAddVersion) return null;

  const active = versions.find((v) => (v.id ?? null) === activeVersionId) || versions[0];

  return (
    <div className="flex items-center gap-1">
      <div
        className={`inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 ${
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
              className={`${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[12px]'} font-semibold rounded-md transition-colors tabular-nums ${
                isActive
                  ? 'bg-white text-gray-800 shadow-sm'
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
          className={`${compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'} inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 font-medium transition-colors`}
          title="Upload a new version"
        >
          <Plus size={compact ? 11 : 12} />
          Version
        </button>
      )}
    </div>
  );
}
