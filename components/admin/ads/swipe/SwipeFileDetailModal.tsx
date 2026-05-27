// components/admin/ads/swipe/SwipeFileDetailModal.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Share2, Check, Pencil, Trash2,
  ExternalLink, Calendar, MousePointerClick, Image as ImageIcon, Video as VideoIcon, Tag, FolderInput,
  Info, FileText, Sparkles, Loader2,
} from 'lucide-react';
import type { SwipeFile, SwipeType } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import SwipeMetaMockup from './SwipeMetaMockup';
import AccordionSection from './AccordionSection';

type Props = {
  files: SwipeFile[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onEdit: (file: SwipeFile) => void;
  onDelete: (file: SwipeFile) => Promise<void>;
  onShared: (file: SwipeFile) => Promise<void>;
  types?: SwipeType[];
  onMove?: (file: SwipeFile, newTypeId: string) => Promise<void>;
  onFieldUpdate?: (file: SwipeFile, field: string, value: string | null) => Promise<void>;
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
  files, currentIndex, onNavigate, onClose, onEdit, onDelete, onShared, types, onMove, onFieldUpdate, readOnly = false,
}: Props) {
  const file = files[currentIndex];
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(file?.transcription || '');
  const [promptDraft, setPromptDraft] = useState(file?.ai_prompt || '');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('details');

  useEffect(() => {
    setTranscriptDraft(file?.transcription || '');
    setPromptDraft(file?.ai_prompt || '');
    setOpenSection('details');
  }, [file?.id, file?.transcription, file?.ai_prompt]);

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? '' : section));
  };

  const handleTranscribe = useCallback(async () => {
    if (!file || transcribing) return;
    setTranscribing(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/ads/swipe/files/${file.id}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transcription failed');
      setTranscriptDraft(json.data.transcription || '');
    } catch (err) {
      console.error('Transcribe error:', err);
    } finally {
      setTranscribing(false);
    }
  }, [file, transcribing]);

  const saveField = useCallback(async (field: string, value: string) => {
    if (!file || !onFieldUpdate) return;
    const trimmed = value.trim() || null;
    const current = field === 'transcription' ? file.transcription : file.ai_prompt;
    if (trimmed === (current || null)) return;
    setSavingField(field);
    try {
      await onFieldUpdate(file, field, trimmed);
    } finally {
      setSavingField(null);
    }
  }, [file, onFieldUpdate]);

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
          <div className="text-sm font-semibold text-ink">Swipe Vault</div>
        ) : (
          <button
            onClick={() => canPrev && onNavigate(currentIndex - 1)}
            disabled={!canPrev}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-edge text-caption text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-caption font-medium ${
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-edge text-caption text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="flex-1">
            {/* Details accordion */}
            <AccordionSection
              title="Details"
              icon={<Info size={14} className="text-faint" />}
              open={openSection === 'details'}
              onToggle={() => toggleSection('details')}
            >
              <div className="space-y-3">
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
                {!readOnly && types && onMove && (
                  <div className="flex items-start gap-3">
                    <FolderInput size={14} className="text-faint mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-detail text-faint mb-1">Folder</p>
                      <select
                        value={file.type_id}
                        disabled={moving}
                        onChange={async (e) => {
                          const newTypeId = e.target.value;
                          if (newTypeId === file.type_id) return;
                          setMoving(true);
                          try {
                            await onMove(file, newTypeId);
                          } finally {
                            setMoving(false);
                          }
                        }}
                        className="w-full text-caption text-ink bg-white border border-edge rounded-lg px-2 py-1.5 hover:border-teal/50 focus:outline-none focus:border-teal disabled:opacity-50"
                      >
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {file.source_url && (
                  <div className="flex items-start gap-3">
                    <ExternalLink size={14} className="text-faint mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-detail text-faint">Landing page</p>
                      <a
                        href={file.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-caption text-teal hover:underline truncate block"
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
                      <p className="text-detail text-faint mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {file.tags.map((t) => (
                          <span key={t} className="text-detail bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {file.notes && (
                  <div className="pt-2 border-t border-edge">
                    <p className="text-detail text-faint mb-1">Notes</p>
                    <p className="text-caption text-ink whitespace-pre-wrap">{file.notes}</p>
                  </div>
                )}
              </div>
            </AccordionSection>

            {/* Transcript accordion (video only) */}
            {file.media_type === 'video' && (
              <AccordionSection
                title="Transcript"
                icon={<FileText size={14} className="text-faint" />}
                open={openSection === 'transcript'}
                onToggle={() => toggleSection('transcript')}
                badge={file.transcription ? undefined : 'Empty'}
              >
                {readOnly ? (
                  file.transcription ? (
                    <p className="text-caption text-ink whitespace-pre-wrap">{file.transcription}</p>
                  ) : (
                    <p className="text-xs text-faint italic">No transcript available.</p>
                  )
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={transcriptDraft}
                      onChange={(e) => setTranscriptDraft(e.target.value)}
                      onBlur={() => saveField('transcription', transcriptDraft)}
                      rows={12}
                      placeholder="Paste or auto-generate a transcript…"
                      className="w-full text-caption text-ink bg-surface border border-edge rounded-lg px-3 py-2 resize-y focus:ring-2 focus:ring-teal/20 outline-none"
                    />
                    {savingField === 'transcription' && (
                      <p className="text-detail text-faint">Saving…</p>
                    )}
                    <button
                      type="button"
                      onClick={handleTranscribe}
                      disabled={transcribing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge text-xs font-medium text-ink hover:bg-surface disabled:opacity-50"
                    >
                      {transcribing ? (
                        <><Loader2 size={12} className="animate-spin" /> Transcribing…</>
                      ) : (
                        <><Sparkles size={12} /> {file.transcription ? 'Re-transcribe' : 'Auto-transcribe'}</>
                      )}
                    </button>
                  </div>
                )}
              </AccordionSection>
            )}

            {/* AI Prompt accordion */}
            {(!readOnly || file.ai_prompt) && (
              <AccordionSection
                title="AI Prompt"
                icon={<Sparkles size={14} className="text-faint" />}
                open={openSection === 'prompt'}
                onToggle={() => toggleSection('prompt')}
                badge={!file.ai_prompt && !readOnly ? 'Optional' : undefined}
              >
                {readOnly ? (
                  <p className="text-caption text-ink whitespace-pre-wrap">{file.ai_prompt}</p>
                ) : (
                  <div className="space-y-1">
                    <textarea
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      onBlur={() => saveField('ai_prompt', promptDraft)}
                      rows={10}
                      placeholder="Paste the prompt you used to generate this creative…"
                      className="w-full text-caption text-ink bg-surface border border-edge rounded-lg px-3 py-2 resize-y focus:ring-2 focus:ring-teal/20 outline-none"
                    />
                    {savingField === 'ai_prompt' && (
                      <p className="text-detail text-faint">Saving…</p>
                    )}
                  </div>
                )}
              </AccordionSection>
            )}
          </div>

          {/* Footer actions */}
          {!readOnly && (
            <div className="px-5 py-4 border-t border-edge">
              {confirmingDelete ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700 font-medium mb-2">Delete this swipe?</p>
                  <p className="text-detail text-red-600 mb-3">This can&apos;t be undone.</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg border border-edge text-xs text-ink hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(file)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-caption font-medium text-ink hover:bg-surface"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  {file.has_been_shared ? (
                    <div
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-detail text-faint cursor-not-allowed"
                      title="This swipe has been shared — delete disabled to avoid breaking the link"
                    >
                      <Trash2 size={13} />
                      <span>Shared</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-caption font-medium text-red-600 hover:bg-red-50 hover:border-red-200"
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
        <p className="text-detail text-faint">{label}</p>
        <p className="text-caption text-ink truncate">{value}</p>
      </div>
    </div>
  );
}
