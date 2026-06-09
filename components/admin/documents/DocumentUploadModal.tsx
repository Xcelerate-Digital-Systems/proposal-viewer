// components/admin/documents/DocumentUploadModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType } from '@/components/ui/FormField';
import { authedFetch } from '@/lib/api-fetch';

interface DocumentUploadModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const formatSize = (bytes: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentUploadModal({ companyId, onClose, onSuccess }: DocumentUploadModalProps) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ title: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [splitFailed, setSplitFailed] = useState(false);
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [uploading, onClose]);

  const handleRetrySplit = async () => {
    if (!createdDocId) return;
    setUploading(true);
    setStatus('Splitting into pages...');
    setSplitFailed(false);

    try {
      const splitRes = await authedFetch('/api/proposals/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: createdDocId, entity_type: 'document' }),
      });

      if (!splitRes.ok) {
        setSplitFailed(true);
        setUploading(false);
        setStatus('');
        return;
      }

      const splitData = await splitRes.json();
      toast.success(`Doc created with ${splitData.page_count} pages!`);
      onSuccess();
      onClose();
      router.push(`/documents/${createdDocId}/pages`);
    } catch {
      setSplitFailed(true);
      setUploading(false);
      setStatus('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('PDF must be under 100 MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setStatus('Uploading PDF...');
    setSplitFailed(false);

    // ── Step 1: Upload PDF to storage ──────────────────────────────
    try {
      // Sanitize filename — Supabase storage rejects spaces and special chars
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `documents/${Date.now()}-${safeName}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/proposals/${filePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(file);
      });

      // ── Step 2: Insert document record (server applies company defaults) ─
      const createRes = await authedFetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          file_path: filePath,
          file_size_bytes: file.size,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error: ${createRes.status}`);
      }

      const { document_id: insertedDocId } = await createRes.json();

      // ── Step 3: Split into individual pages (awaited, with status) ─
      setStatus('Splitting into pages...');

      const splitRes = await authedFetch('/api/proposals/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: insertedDocId, entity_type: 'document' }),
      });

      if (!splitRes.ok) {
        setSplitFailed(true);
        setCreatedDocId(insertedDocId);
        setUploading(false);
        setStatus('');
        return;
      }

      const splitData = await splitRes.json();
      toast.success(`Doc created with ${splitData.page_count} pages!`);

      onSuccess();
      onClose();
      router.push(`/documents/${insertedDocId}/pages`);
    } catch (err) {
      console.error(err);
      toast.error('Upload failed. Please try again.');
      setStatus('');
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg border border-edge-strong">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-ink">
            New Document
          </h2>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} disabled={uploading} aria-label="Close" />
        </div>

        {splitFailed ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Page splitting failed</p>
                <p className="text-sm text-amber-700 mt-1">
                  Your document was uploaded but couldn&apos;t be split into pages. You can retry or skip and split later.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleRetrySplit} disabled={uploading} leftIcon={uploading ? Loader2 : undefined}>
                {uploading ? 'Splitting...' : 'Retry split'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onSuccess();
                  onClose();
                  router.push(`/documents/${createdDocId}/pages`);
                }}
              >
                Skip for now
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="p-6 space-y-4">
            <FormFields
              fields={fieldsByType.document}
              values={form}
              onChange={(key, value) => setForm({ ...form, [key]: value })}
              disabled={uploading}
            />

            <div>
              <label className="block text-sm font-medium text-prose mb-1">PDF File</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-edge-hover rounded-2xl cursor-pointer hover:border-teal/40 hover:bg-teal/5 focus-within:ring-2 focus-within:ring-teal/30 transition-colors">
                {file ? (
                  <div className="flex items-center gap-2 text-sm text-dim">
                    <FileText size={20} className="text-teal" />
                    <span className="font-medium text-ink">{file.name}</span>
                    <span className="text-dim">({formatSize(file.size)})</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={24} className="text-dim" />
                    <span className="text-sm text-dim">Click to upload PDF</span>
                    <span className="text-xs text-dim">Each page becomes individually editable</span>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={uploading}
                />
              </label>
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dim flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-teal" />
                    {status}
                  </span>
                  {status === 'Uploading PDF...' && (
                    <span className="text-teal font-medium">{uploadProgress}%</span>
                  )}
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal rounded-full transition-all duration-300 ease-out"
                    style={{ width: status === 'Uploading PDF...' ? `${uploadProgress}%` : '100%' }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="primary"
              type="submit"
              disabled={uploading || !file || !form.title.trim()}
              className="w-full"
            >
              {uploading ? 'Processing...' : 'Create Document'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
