'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, History, ChevronDown, Check, Pencil } from 'lucide-react';
import type { VersionView } from '@/lib/feedback/versions';

interface VersionPickerProps {
  versions: VersionView[];
  activeVersionId: string | null;
  onChange: (versionId: string | null) => void;
  /** If omitted, the "+" button is hidden — used on the public/client side. */
  onAddVersion?: () => void;
  /** Optional admin affordance: opens the editor for the given version. */
  onEditVersion?: (versionId: string | null) => void;
  compact?: boolean;
}

/**
 * Dropdown showing the active version with a chevron. Opens a menu listing
 * every version (latest first) with notes + relative timestamp. The "+"
 * button only renders when callers (admin) opt in via onAddVersion.
 */
export default function VersionPicker({
  versions, activeVersionId, onChange, onAddVersion, onEditVersion, compact = false,
}: VersionPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  if (!versions.length) return null;

  const active = versions.find((v) => (v.id ?? null) === activeVersionId) || versions[0];
  const ordered = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  const padding = compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <div ref={wrapperRef} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full bg-gray-50 ${padding} font-semibold text-ink hover:bg-gray-100 transition-colors`}
        title="Select version"
      >
        <History size={compact ? 12 : 13} className="text-gray-400" />
        <span className="tabular-nums">v{active.versionNumber}</span>
        <ChevronDown size={compact ? 11 : 12} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-30 w-64 bg-white border border-gray-100 rounded-xl shadow-lg py-1 max-h-72 overflow-y-auto">
          {ordered.map((v) => {
            const isActive = (v.id ?? null) === (active.id ?? null);
            return (
              <div
                key={v.id ?? 'v1'}
                className={`group flex items-start gap-2 px-3 py-2 hover:bg-gray-50 ${
                  isActive ? 'bg-gray-50' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(v.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2 flex-1 min-w-0 text-left"
                >
                  <span className="text-xs font-semibold text-ink tabular-nums shrink-0 mt-0.5">
                    v{v.versionNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 truncate">
                      {v.notes || (v.versionNumber === 1 ? 'Initial version' : 'New version')}
                    </p>
                    <p className="text-2xs text-gray-400 mt-0.5">
                      {formatTimestamp(v.createdAt)}
                    </p>
                  </div>
                  {isActive && (
                    <Check size={12} className="text-teal shrink-0 mt-1" />
                  )}
                </button>
                {onEditVersion && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditVersion(v.id);
                      setOpen(false);
                    }}
                    className="text-gray-400 hover:text-ink transition-colors p-1 -m-1 shrink-0"
                    title={`Edit v${v.versionNumber} content`}
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {onAddVersion && (
        <button
          onClick={onAddVersion}
          className={`${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} inline-flex items-center gap-1 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-medium transition-colors`}
          title="Upload a new version"
        >
          <Plus size={compact ? 11 : 12} />
          Version
        </button>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
