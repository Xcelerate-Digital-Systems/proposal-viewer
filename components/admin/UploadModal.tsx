'use client';

import { useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return '\u2014';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [form, setForm] = useState({ title: '', client_name: '', client_email: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    const { supabase } = await import('@/lib/supabase');

    try {
      const filePath = `${Date.now()}-${file.name}`;

      // Use XMLHttpRequest for progress tracking
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

      const { error: dbError } = await supabase.from('proposals').insert({
        title: form.title,
        client_name: form.client_name,
        client_email: form.client_email || null,
        description: form.description || null,
        file_path: filePath,
        file_size_bytes: file.size,
        status: 'draft',
        page_names: [],
      });

      if (dbError) throw dbError;

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-lg border border-[#2a2a2a]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-white">
            New Proposal
          </h2>
          <button onClick={onClose} className="text-[#666] hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleUpload} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Website Redesign Proposal"
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#999] mb-1">Client Name</label>
              <input
                type="text"
                required
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#999] mb-1">Client Email</label>
              <input
                type="email"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                placeholder="john@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Brief note about this proposal..."
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 resize-none placeholder:text-[#555]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">PDF File</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#2a2a2a] rounded-xl cursor-pointer hover:border-[#ff6700]/40 hover:bg-[#ff6700]/5 transition-colors">
              {file ? (
                <div className="flex items-center gap-2 text-sm text-[#999]">
                  <FileText size={20} className="text-[#ff6700]" />
                  <span className="font-medium text-white">{file.name}</span>
                  <span className="text-[#666]">({formatSize(file.size)})</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={24} className="text-[#444]" />
                  <span className="text-sm text-[#666]">Click to upload PDF</span>
                </div>
              )}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#999]">Uploading...</span>
                <span className="text-[#ff6700] font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff6700] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-[#ff6700] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Creating proposal...' : 'Create Proposal'}
          </button>
        </form>
      </div>
    </div>
  );
}