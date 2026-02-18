// components/admin/TemplateUploadModal.tsx
'use client';

import { useState } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TemplateUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function TemplateUploadModal({ onClose, onSuccess }: TemplateUploadModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setUploading(true);
    setStatus('Uploading PDF...');

    // Upload to a temp location first
    const tempPath = `templates/temp-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(tempPath, file, { contentType: 'application/pdf' });

    if (uploadError) {
      setStatus('Upload failed. Please try again.');
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
      }),
    });

    if (!res.ok) {
      setStatus('Failed to process template. Please try again.');
      setUploading(false);
      return;
    }

    const data = await res.json();
    setStatus(`Created template with ${data.page_count} pages!`);

    setTimeout(() => {
      onSuccess();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-md border border-[#2a2a2a]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)]">
            New Template
          </h2>
          <button onClick={onClose} className="text-[#666] hover:text-white" disabled={uploading}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Template Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Proposal Template"
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#999] mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
              disabled={uploading}
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
                  <span className="text-xs text-[#444]">Each page becomes a reusable template page</span>
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

          {status && (
            <div className="flex items-center gap-2 text-sm text-[#999]">
              {uploading && <Loader2 size={14} className="animate-spin text-[#ff6700]" />}
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !file || !name.trim()}
            className="w-full bg-[#ff6700] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing...' : 'Create Template'}
          </button>
        </form>
      </div>
    </div>
  );
}