// components/admin/ads/swipe/SwipeFileForm.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Upload, Loader2 } from 'lucide-react';
import type { SwipeFile, SwipeMediaType } from '@/lib/supabase';

type Props = {
  companyId: string;
  typeId: string;
  file?: SwipeFile;
  knownTags?: string[];
  uploadMedia: (file: File, swipeId?: string) => Promise<{ url?: string; media_type?: 'image' | 'video'; error?: string }>;
  onClose: () => void;
  onSave: (data: Partial<SwipeFile>) => Promise<void>;
};

export default function SwipeFileForm({ file, knownTags = [], uploadMedia, onClose, onSave }: Props) {
  const [tags, setTags] = useState<string[]>(file?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [brand, setBrand] = useState(file?.brand || '');
  const [headline, setHeadline] = useState(file?.headline || '');
  const [primaryText, setPrimaryText] = useState(file?.primary_text || '');
  const [description, setDescription] = useState(file?.description || '');
  const [cta, setCta] = useState(file?.cta || '');
  const [sourceUrl, setSourceUrl] = useState(file?.source_url || '');
  const [notes, setNotes] = useState(file?.notes || '');
  const [aiPrompt, setAiPrompt] = useState(file?.ai_prompt || '');

  const [mediaUrl, setMediaUrl] = useState(file?.media_url || '');
  const [mediaType, setMediaType] = useState<SwipeMediaType | null>(file?.media_type || null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (selected: File) => {
    setError(null);
    setUploading(true);
    const result = await uploadMedia(selected, file?.id);
    setUploading(false);
    if (result.error || !result.url) {
      setError(result.error || 'Upload failed');
      return;
    }
    setMediaUrl(result.url);
    setMediaType(result.media_type || 'image');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) await processFile(selected);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) await processFile(dropped);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Title is hidden from the UI but still a required DB field — derive a sensible default.
      const derivedTitle =
        (file?.title?.trim()) ||
        brand.trim() ||
        headline.trim().slice(0, 60) ||
        'Untitled swipe';

      await onSave({
        title: derivedTitle,
        tags,
        brand: brand.trim() || null,
        headline: headline.trim() || null,
        primary_text: primaryText.trim() || null,
        description: description.trim() || null,
        cta: cta.trim() || null,
        source_url: sourceUrl.trim() || null,
        notes: notes.trim() || null,
        ai_prompt: aiPrompt.trim() || null,
        media_url: mediaUrl.trim() || null,
        media_type: mediaType,
        media_source: mediaUrl ? 'upload' : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <h2 className="text-base font-semibold text-ink">{file ? 'Edit Swipe' : 'New Swipe'}</h2>
          <button onClick={onClose} className="text-faint hover:text-ink"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Brand</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none"
              placeholder="Advertiser name"
            />
          </div>

          {/* Media */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Image or video</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              disabled={uploading}
              className={`w-full flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed rounded-xl transition-colors ${
                dragging
                  ? 'border-teal bg-teal/5'
                  : 'border-edge hover:border-teal/50 hover:bg-surface'
              } ${uploading ? 'opacity-60 cursor-wait' : ''}`}
            >
              {uploading ? (
                <>
                  <Loader2 size={24} className="text-teal animate-spin" />
                  <span className="text-sm font-medium text-ink">Uploading…</span>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-faint" />
                  <span className="text-sm font-medium text-ink">
                    {mediaUrl ? 'Replace file' : 'Select file'}
                  </span>
                  <span className="text-xs text-faint">Images and videos, up to 100MB each</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              onChange={handleFileSelect}
              className="hidden"
            />

            {mediaUrl && (
              <div className="mt-3 rounded-lg overflow-hidden border border-edge bg-surface h-48 flex items-center justify-center">
                {(mediaType === 'video' || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl)) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={mediaUrl} controls className="max-h-full max-w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
                )}
              </div>
            )}
          </div>

          {/* Meta ad copy */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Headline</label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Primary Text</label>
              <textarea
                value={primaryText}
                onChange={(e) => setPrimaryText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">CTA</label>
                <input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Shop Now"
                  className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tags (angles) */}
          <div ref={tagDropdownRef} className="relative">
            <label className="block text-xs font-medium text-muted mb-1.5">Angle tags</label>
            <button
              type="button"
              onClick={() => setTagDropdownOpen((v) => !v)}
              className="w-full flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-2 border border-edge rounded-lg text-left hover:border-teal/40 focus:ring-2 focus:ring-teal/20 outline-none"
            >
              {tags.length === 0 ? (
                <span className="text-sm text-faint">Select or create tags…</span>
              ) : (
                tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                    {t}
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setTags(tags.filter((x) => x !== t)); }}
                      className="hover:text-teal-hover cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))
              )}
              <ChevronDown size={14} className="text-faint ml-auto shrink-0" />
            </button>

            {tagDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-edge rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-edge shrink-0">
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        const v = tagInput.trim();
                        if (!tags.includes(v)) setTags([...tags, v]);
                        setTagInput('');
                      }
                    }}
                    placeholder="Search or create tag…"
                    className="w-full px-2 py-1.5 text-sm border border-edge rounded outline-none focus:ring-2 focus:ring-teal/20"
                  />
                </div>
                <div className="overflow-y-auto flex-1 py-1">
                  {(() => {
                    const q = tagInput.trim().toLowerCase();
                    const filtered = knownTags.filter((t) => !q || t.toLowerCase().includes(q));
                    const exactMatch = knownTags.some((t) => t.toLowerCase() === q);
                    return (
                      <>
                        {filtered.length === 0 && !tagInput.trim() && (
                          <p className="text-xs text-faint px-3 py-2">No tags yet — type to create one</p>
                        )}
                        {filtered.map((t) => {
                          const selected = tags.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                if (selected) setTags(tags.filter((x) => x !== t));
                                else setTags([...tags, t]);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface flex items-center justify-between ${
                                selected ? 'text-teal font-medium' : 'text-ink'
                              }`}
                            >
                              <span>{t}</span>
                              {selected && <span className="text-xs">✓</span>}
                            </button>
                          );
                        })}
                        {tagInput.trim() && !exactMatch && (
                          <button
                            type="button"
                            onClick={() => {
                              const v = tagInput.trim();
                              if (!tags.includes(v)) setTags([...tags, v]);
                              setTagInput('');
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-teal hover:bg-surface border-t border-edge"
                          >
                            + Create &ldquo;{tagInput.trim()}&rdquo;
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Source + notes */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Source URL (Meta Ad Library, etc.)</label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">AI Prompt <span className="text-faint font-normal">(optional)</span></label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="Paste the prompt you used to generate this creative…"
              className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none resize-none"
            />
          </div>
        </form>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-edge shrink-0 bg-white rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-muted hover:text-ink">Cancel</button>
          <button
            type="button"
            onClick={(e) => submit(e as unknown as React.FormEvent)}
            disabled={saving}
            className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Swipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
