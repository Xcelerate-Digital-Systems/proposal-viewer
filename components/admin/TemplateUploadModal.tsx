// components/admin/TemplateUploadModal.tsx
'use client';

import { useState } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface TemplateUploadModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function TemplateUploadModal({ companyId, onClose, onSuccess }: TemplateUploadModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setUploading(true);
    setUploadProgress(0);
    setStatus('Uploading PDF...');

    const tempPath = `templates/temp-${Date.now()}.pdf`;

    try {
      // XHR upload with progress tracking
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
        xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/proposals/${tempPath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(file);
      });
    } catch {
      toast.error('Upload failed. Please try again.');
      setStatus('');
      setUploading(false);
      return;
    }

    setStatus('Splitting into pages...');

    // Call split API
    const res = await fetch('/api/templates/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_name: name.trim(),
        template_description: description.trim() || null,
        file_path: tempPath,
        company_id: companyId,
      }),
    });

    if (!res.ok) {
      toast.error('Failed to process template. Please try again.');
      setStatus('');
      setUploading(false);
      return;
    }

    const data = await res.json();
    toast.success(`Template created with ${data.page_count} pages!`);

    setTimeout(() => {
      onSuccess();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-display)]">
            New Template
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={uploading}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Proposal Template"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#017C87]/40 hover:bg-[#017C87]/5 transition-colors">
              {file ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <FileText size={20} className="text-[#017C87]" />
                  <span className="font-medium text-gray-900">{file.name}</span>
                  <span className="text-gray-400">({formatSize(file.size)})</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={24} className="text-gray-300" />
                  <span className="text-sm text-gray-400">Click to upload PDF</span>
                  <span className="text-xs text-gray-300">Each page becomes a reusable template page</span>
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
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin text-[#017C87]" />
                  {status}
                </span>
                {status === 'Uploading PDF...' && (
                  <span className="text-[#017C87] font-medium">{uploadProgress}%</span>
                )}
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#017C87] rounded-full transition-all duration-300 ease-out"
                  style={{ width: status === 'Uploading PDF...' ? `${uploadProgress}%` : '100%' }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !file || !name.trim()}
            className="w-full bg-[#017C87] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing...' : 'Create Template'}
          </button>
        </form>
      </div>
    </div>
  );
}