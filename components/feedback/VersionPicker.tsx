'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, History, ChevronDown, Check, Pencil, Columns2, AlertTriangle, X } from 'lucide-react';
import type { VersionView } from '@/lib/feedback/versions';
interface VersionPickerProps {
  versions: VersionView[];
  activeVersionId: string | null;
  onChange: (versionId: string | null) => void;
  /** If omitted, the "+" button is hidden — used on the public/client side. */
  onAddVersion?: () => void;
  /** Optional admin affordance: opens the editor for the given version. */
  onEditVersion?: (versionId: string | null) => void;
  /** Opens the side-by-side version comparison view. Only shown when 2+ versions exist. */
  onCompare?: () => void;
  /** @deprecated Status is now shown via ClientStatusControl instead. */
  itemStatus?: unknown;
  compact?: boolean;
}

/**
 * Dropdown showing the active version with a chevron. Opens a menu listing
 * every version (latest first) with notes + relative timestamp. The "+"
 * button only renders when callers (admin) opt in via onAddVersion.
 */
export default function VersionPicker({
  versions, activeVersionId, onChange, onAddVersion, onEditVersion, onCompare, itemStatus, compact = false,
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

  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Reset the dismissed state when the selected version changes so the
  // banner reappears if the user picks a different old version.
  const prevVersionRef = useRef(activeVersionId);
  useEffect(() => {
    if (prevVersionRef.current !== activeVersionId) {
      setBannerDismissed(false);
      prevVersionRef.current = activeVersionId;
    }
  }, [activeVersionId]);

  if (!versions.length) return null;

  const active = versions.find((v) => (v.id ?? null) === activeVersionId) || versions[0];
  const ordered = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const latestVersion = ordered[0];
  const isViewingOlderVersion = versions.length > 1 && (active.id ?? null) !== (latestVersion.id ?? null);

  const padding = compact ? 'px-2 py-1 text-detail' : 'px-2.5 py-1 text-xs';

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full bg-white ${padding} font-semibold text-ink hover:bg-surface transition-colors`}
        title="Select version"
      >
        <History size={compact ? 12 : 13} className="text-faint" />
        <span className="tabular-nums">v{active.versionNumber}</span>
        <ChevronDown size={compact ? 11 : 12} className="text-faint" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-72 bg-white border border-edge rounded-2xl shadow-lg py-1 max-h-72 overflow-y-auto">
          {ordered.map((v) => {
            const isActive = (v.id ?? null) === (active.id ?? null);
            return (
              <div
                key={v.id ?? 'v1'}
                className={`group flex items-start gap-2 px-3 py-2 hover:bg-surface ${
                  isActive ? 'bg-surface' : ''
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
                    <p className="text-xs text-dim truncate">
                      {v.notes || (v.versionNumber === 1 ? 'Initial version' : 'New version')}
                    </p>
                    <p className="text-2xs text-faint mt-0.5">
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
                    className="text-faint hover:text-ink transition-colors p-1 -m-1 shrink-0"
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
          className={`${compact ? 'px-2.5 py-1 text-detail' : 'px-3 py-1.5 text-xs'} inline-flex items-center gap-1 rounded-full text-dim hover:bg-surface hover:text-prose font-medium transition-colors`}
          title="Upload a new version"
        >
          <Plus size={compact ? 11 : 12} />
          Version
        </button>
      )}

      {onCompare && versions.length >= 2 && (
        <button
          type="button"
          onClick={onCompare}
          className={`inline-flex items-center justify-center rounded-full ${compact ? 'w-6 h-6' : 'w-7 h-7'} text-dim hover:bg-surface hover:text-prose transition-colors`}
          title="Compare versions"
        >
          <Columns2 size={compact ? 12 : 13} />
        </button>
      )}
    </div>

      {/* Old-version warning banner */}
      {isViewingOlderVersion && !bannerDismissed && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <span className="flex-1">You&apos;re viewing an older version</span>
          <button
            type="button"
            onClick={() => {
              onChange(latestVersion.id);
              setBannerDismissed(true);
            }}
            className="font-semibold text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap"
          >
            View latest
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0 -mr-1"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
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
