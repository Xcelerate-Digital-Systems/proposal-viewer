// components/admin/ads/swipe/SwipeBulkUploadModal.tsx
'use client';

import { useRef, useState } from 'react';
import { X, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { SwipeFile } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type Status = 'pending' | 'uploading' | 'done' | 'error';

type Row = {
  file: File;
  status: Status;
  error?: string;
};

type Props = {
  typeId: string;
  uploadMedia: (file: File, swipeId?: string) => Promise<{ url?: string; media_type?: 'image' | 'video'; error?: string }>;
  createFile: (data: Partial<SwipeFile> & { type_id: string; title: string }) => Promise<{ data?: SwipeFile; error?: string }>;
  onClose: () => void;
  onComplete: () => void;
};

/** Strip extension + tidy underscores/hyphens so the filename becomes a usable default title */
function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}

export default function SwipeBulkUploadModal({ typeId, uploadMedia, createFile, onClose, onComplete }: Props) {
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

  const runUploads = async () => {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'uploading' } : r)));
      try {
        const upload = await uploadMedia(rows[i].file);
        if (upload.error || !upload.url) {
          throw new Error(upload.error || 'Upload failed');
        }
        const created = await createFile({
          type_id: typeId,
          title: titleFromFilename(rows[i].file.name),
          media_url: upload.url,
          media_type: upload.media_type || 'image',
          media_source: 'upload',
        });
        if (created.error) throw new Error(created.error);
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'done' } : r)));
      } catch (err) {
        setRows((prev) => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: err instanceof Error ? err.message : 'Failed' } : r
        ));
      }
    }
    setRunning(false);
    setFinished(true);
    onComplete();
  };

  const successCount = rows.filter((r) => r.status === 'done').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Bulk Upload</h2>
            <p className="text-xs text-faint mt-0.5">Drop images or videos — fill in details later</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {rows.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-edge rounded-2xl hover:border-teal/50 hover:bg-surface transition-colors"
          >
            <Upload size={24} className="text-faint" />
            <span className="text-sm font-medium text-ink">Select files</span>
            <span className="text-xs text-faint">Images and videos, up to 100MB each</span>
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
                  onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = ''; }}
                  className="text-xs text-faint hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface rounded-lg text-xs">
                  <span className="flex-1 truncate text-ink">{row.file.name}</span>
                  <span className="text-faint whitespace-nowrap">{(row.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <StatusIcon status={row.status} />
                </div>
              ))}
            </div>
            {errorCount > 0 && (
              <p className="text-detail text-red-600">
                {rows.filter((r) => r.status === 'error').map((r) => `${r.file.name}: ${r.error}`).join(' · ')}
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
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {finished ? 'Close' : 'Cancel'}
        </Button>
        {rows.length > 0 && !finished && (
          <Button
            size="sm"
            loading={running}
            disabled={running}
            onClick={runUploads}
          >
            {running ? 'Uploading…' : `Upload ${rows.length} file${rows.length !== 1 ? 's' : ''}`}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'pending') return <span className="w-4 h-4 rounded-full border border-edge" />;
  if (status === 'uploading') return <Loader2 size={14} className="text-teal animate-spin" />;
  if (status === 'done') return <Check size={14} className="text-teal" />;
  return <AlertCircle size={14} className="text-red-600" />;
}
