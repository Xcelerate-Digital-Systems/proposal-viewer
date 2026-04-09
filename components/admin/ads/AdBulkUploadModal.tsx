// components/admin/ads/AdBulkUploadModal.tsx
'use client';

import { useRef, useState } from 'react';
import { X, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Status = 'pending' | 'uploading' | 'done' | 'error';

type Row = {
  file: File;
  status: Status;
  error?: string;
};

type CreateResult = { data?: { id: string }; error?: string };
type UpdateResult = { data?: unknown; error?: string };

type Props = {
  trackerId: string;
  companyId: string;
  createCreative: (data: Record<string, unknown>) => Promise<CreateResult>;
  updateCreative: (id: string, data: Record<string, unknown>) => Promise<UpdateResult>;
  onClose: () => void;
  onComplete: () => void;
};

/** Strip extension + tidy underscores/hyphens so the filename becomes a default ad name. */
function nameFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}

export default function AdBulkUploadModal({
  trackerId,
  companyId,
  createCreative,
  updateCreative,
  onClose,
  onComplete,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setRows(picked.map((f) => ({ file: f, status: 'pending' as const })));
    setFinished(false);
  };

  const uploadOne = async (file: File): Promise<void> => {
    // Step 1: create the creative with just the filename-derived ad_name
    const created = await createCreative({
      tracker_id: trackerId,
      ad_name: nameFromFilename(file.name),
      status: 'draft',
    });
    if (created.error || !created.data) {
      throw new Error(created.error || 'Failed to create creative');
    }

    const creativeId = created.data.id;

    // Step 2: upload file bytes directly to Supabase Storage
    const ext = file.name.split('.').pop() || 'bin';
    const path = `ad-creatives/${companyId}/${creativeId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed');
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    // Step 3: patch the creative with image_url and media_type
    const isVideo = file.type.startsWith('video/');
    const patched = await updateCreative(creativeId, {
      image_url: urlData.publicUrl,
      media_type: isVideo ? 'video' : 'still',
    });
    if (patched.error) throw new Error(patched.error);
  };

  const runUploads = async () => {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'uploading' } : r)));
      try {
        // Client-side size guard
        if (rows[i].file.size > 500 * 1024 * 1024) {
          throw new Error('File too large (max 500MB)');
        }
        const allowed = [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'video/mp4', 'video/quicktime', 'video/webm',
        ];
        if (!allowed.includes(rows[i].file.type)) {
          throw new Error('Invalid file type');
        }
        await uploadOne(rows[i].file);
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'done' } : r)));
      } catch (err) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: 'error', error: err instanceof Error ? err.message : 'Failed' }
              : r
          )
        );
      }
    }
    setRunning(false);
    setFinished(true);
    onComplete();
  };

  const successCount = rows.filter((r) => r.status === 'done').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink">Bulk Upload</h2>
            <p className="text-xs text-faint mt-0.5">
              Drop images or videos — fill in details later
            </p>
          </div>
          <button onClick={onClose} className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          {rows.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-edge rounded-xl hover:border-teal/50 hover:bg-surface transition-colors"
            >
              <Upload size={24} className="text-faint" />
              <span className="text-sm font-medium text-ink">Select files</span>
              <span className="text-xs text-faint">Images and videos, up to 500MB each</span>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {rows.length} file{rows.length !== 1 ? 's' : ''} selected
                  {finished && ` · ${successCount} uploaded${errorCount > 0 ? `, ${errorCount} failed` : ''}`}
                </span>
                {!running && !finished && (
                  <button
                    onClick={() => {
                      setRows([]);
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                    className="text-xs text-faint hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 bg-surface rounded-lg text-xs"
                  >
                    <span className="flex-1 truncate text-ink">{row.file.name}</span>
                    <span className="text-faint whitespace-nowrap">
                      {(row.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <StatusIcon status={row.status} />
                  </div>
                ))}
              </div>
              {errorCount > 0 && (
                <p className="text-[11px] text-red-600">
                  {rows
                    .filter((r) => r.status === 'error')
                    .map((r) => `${r.file.name}: ${r.error}`)
                    .join(' · ')}
                </p>
              )}
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            onChange={handleSelect}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-edge shrink-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted hover:text-ink">
            {finished ? 'Close' : 'Cancel'}
          </button>
          {rows.length > 0 && !finished && (
            <button
              onClick={runUploads}
              disabled={running}
              className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {running && <Loader2 size={14} className="animate-spin" />}
              {running
                ? 'Uploading…'
                : `Upload ${rows.length} file${rows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'pending') return <span className="w-4 h-4 rounded-full border border-edge" />;
  if (status === 'uploading') return <Loader2 size={14} className="text-teal animate-spin" />;
  if (status === 'done') return <Check size={14} className="text-teal" />;
  return <AlertCircle size={14} className="text-red-600" />;
}
