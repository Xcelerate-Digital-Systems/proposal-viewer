// components/admin/quotes/sections/AttachmentsSection.tsx
// File attachments stored on the proposals row as JSONB. Files live under
// `proposals` bucket at `attachments/<quote_id>/<timestamp>-<name>`. The
// public viewer renders these as downloadable links via signed URLs.
'use client';

import { useRef, useState } from 'react';
import { Paperclip, Upload, X, Loader2 } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import type { QuoteAttachment } from '@/lib/types/proposals';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;       // 10 MB per file
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;      // 30 MB total
const MAX_FILES = 10;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QuoteAttachment[]>(
    Array.isArray(proposal.attachments) ? proposal.attachments : [],
  );
  const [uploading, setUploading] = useState(false);

  const totalBytes = items.reduce((acc, x) => acc + x.size, 0);

  const persist = async (next: QuoteAttachment[]) => {
    const { error } = await supabase
      .from('proposals')
      .update({ attachments: next })
      .eq('id', proposal.id);
    if (error) {
      toast.error('Failed to save attachments');
      return false;
    }
    onSaved();
    return true;
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);

    if (items.length + incoming.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} files`);
      return;
    }
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" exceeds 10 MB`);
        return;
      }
    }
    const addedBytes = incoming.reduce((a, f) => a + f.size, 0);
    if (totalBytes + addedBytes > MAX_TOTAL_BYTES) {
      toast.error('Total attachments would exceed 30 MB');
      return;
    }

    setUploading(true);
    try {
      const uploaded: QuoteAttachment[] = [];
      for (const file of incoming) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `attachments/${proposal.id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage
          .from('proposals')
          .upload(path, file, { upsert: false });
        if (error) throw error;
        uploaded.push({
          name: file.name,
          path,
          size: file.size,
          mime: file.type || 'application/octet-stream',
        });
      }
      const next = [...items, ...uploaded];
      const ok = await persist(next);
      if (ok) {
        setItems(next);
        toast.success(`${uploaded.length} file${uploaded.length === 1 ? '' : 's'} attached`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeAt = async (idx: number) => {
    const removed = items[idx];
    const next = items.filter((_, i) => i !== idx);
    const ok = await persist(next);
    if (ok) {
      setItems(next);
      // Best-effort delete of the storage object — silent if it fails.
      await supabase.storage.from('proposals').remove([removed.path]).catch(() => {});
    }
  };

  return (
    <SectionCard
      title="Attachments"
      description="Files will be visible on the customer quote as downloadable links."
      action={
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || items.length >= MAX_FILES}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Add file
        </button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-edge-strong rounded-lg px-4 py-8 text-center hover:border-edge-hover transition-colors"
        >
          <Paperclip size={20} className="mx-auto text-faint mb-2" />
          <p className="text-sm text-dim">
            PDFs, images, documents — up to 10 MB each, 30 MB total, max 10 files
          </p>
        </button>
      ) : (
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li
              key={a.path}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-edge-strong bg-white"
            >
              <Paperclip size={14} className="text-faint shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink truncate">{a.name}</div>
                <div className="text-xs text-faint">{formatSize(a.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="p-1 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-detail text-faint mt-3 tabular-nums">
        {items.length} / {MAX_FILES} files · {formatSize(totalBytes)} / 30 MB
      </p>
    </SectionCard>
  );
}
