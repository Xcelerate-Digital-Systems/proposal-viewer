// components/admin/ads/swipe/SwipeFileDetailModal.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Share2, Check, Pencil, Trash2,
  ExternalLink, Calendar, MousePointerClick, Image as ImageIcon, Video as VideoIcon, Tag,
} from 'lucide-react';
import type { SwipeFile } from '@/lib/supabase';
import SwipeMetaMockup from './SwipeMetaMockup';

type Props = {
  files: SwipeFile[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onEdit: (file: SwipeFile) => void;
  /** Must actually delete the swipe. Parent should refresh its list. */
  onDelete: (file: SwipeFile) => Promise<void>;
  /** Called after a successful share so the parent can persist has_been_shared. */
  onShared: (file: SwipeFile) => Promise<void>;
  /** Read-only mode hides edit/delete actions (used by public viewer). */
  readOnly?: boolean;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export default function SwipeFileDetailModal({
  files, currentIndex, onNavigate, onClose, onEdit, onDelete, onShared, readOnly = false,
}: Props) {
  const file = files[currentIndex];
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Keyboard nav (admin-only)
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
      else if (e.key === 'ArrowRight' && currentIndex < files.length - 1) onNavigate(currentIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, files.length, onClose, onNavigate, readOnly]);

  if (!file) return null;

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < files.length - 1;

  const handleShare = async () => {
    setSharing(true);
    try {
      const url = `${window.location.origin}/swipe/${file.share_token}`;
      await navigator.clipboard.writeText(url);
      await onShared(file);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(file);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const landingHost = hostFromUrl(file.source_url);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
      onClick={readOnly ? undefined : onClose}
    >
      {/* Top toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-white border-b border-edge shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {readOnly ? (
          <div className="text-sm font-semibold text-ink">Swipe File</div>
        ) : (
          <button
            onClick={() => canPrev && onNavigate(currentIndex - 1)}
            disabled={!canPrev}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-edge text-[13px] text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> Previous
          </button>
        )}

        <div className="flex items-center gap-3">
          {!readOnly && (
            <span className="text-xs text-faint">
              {currentIndex + 1} of {files.length}
            </span>
          )}
          {!readOnly && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium ${
                copied ? 'border-teal text-teal' : 'border-edge text-ink hover:bg-surface'
              }`}
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={() => canNext && onNavigate(currentIndex + 1)}
                disabled={!canNext}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-edge text-[13px] text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={16} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg border border-edge text-ink hover:bg-surface"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 min-h-0 flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mockup pane */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-[#f0f2f5] p-6 lg:p-10 flex items-start justify-center">
          <div className="w-full max-w-[500px]">
            <SwipeMetaMockup file={file} />
          </div>
        </div>

        {/* Details pane */}
        <aside className="w-[340px] shrink-0 border-l border-edge bg-white overflow-y-auto flex flex-col">
          <div className="px-5 py-4 border-b border-edge">
            <h2 className="text-sm font-semibold text-ink">Details</h2>
          </div>

          <div className="px-5 py-4 space-y-3 flex-1">
            <DetailRow icon={<span className="text-[15px]">🏷️</span>} label="Brand" value={file.brand || '—'} />
            <DetailRow
              icon={<Calendar size={14} className="text-faint" />}
              label="Added"
              value={formatDate(file.created_at)}
            />
            {file.cta && (
              <DetailRow
                icon={<MousePointerClick size={14} className="text-faint" />}
                label="CTA"
                value={file.cta}
              />
            )}
            <DetailRow
              icon={
                file.media_type === 'video'
                  ? <VideoIcon size={14} className="text-faint" />
                  : <ImageIcon size={14} className="text-faint" />
              }
              label="Format"
              value={file.media_type === 'video' ? 'Video' : 'Image'}
            />
            {file.source_url && (
              <div className="flex items-start gap-3">
                <ExternalLink size={14} className="text-faint mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-faint">Landing page</p>
                  <a
                    href={file.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-teal hover:underline truncate block"
                    title={file.source_url}
                  >
                    {landingHost || file.source_url}
                  </a>
                </div>
              </div>
            )}
            {file.tags && file.tags.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag size={14} className="text-faint mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-faint mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {file.tags.map((t) => (
                      <span key={t} className="text-[11px] bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {file.notes && (
              <div className="pt-2 border-t border-edge">
                <p className="text-[11px] text-faint mb-1">Notes</p>
                <p className="text-[13px] text-ink whitespace-pre-wrap">{file.notes}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!readOnly && (
            <div className="px-5 py-4 border-t border-edge">
              {confirmingDelete ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-[12px] text-red-700 font-medium mb-2">Delete this swipe?</p>
                  <p className="text-[11px] text-red-600 mb-3">This can&apos;t be undone.</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg border border-edge text-[12px] text-ink hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(file)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-[13px] font-medium text-ink hover:bg-surface"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  {file.has_been_shared ? (
                    <div
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-[11px] text-faint cursor-not-allowed"
                      title="This swipe has been shared — delete disabled to avoid breaking the link"
                    >
                      <Trash2 size={13} />
                      <span>Shared</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-[13px] font-medium text-red-600 hover:bg-red-50 hover:border-red-200"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-faint">{label}</p>
        <p className="text-[13px] text-ink truncate">{value}</p>
      </div>
    </div>
  );
}
