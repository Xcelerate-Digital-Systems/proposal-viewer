// components/admin/proposals/UploadModal.tsx
'use client';

import { useState } from 'react';
import { Upload, FileText, X, LayoutTemplate } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType } from '@/components/ui/FormField';
import CreateFromTemplate from './CreateFromTemplate';

interface UploadModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function UploadModal({ companyId, onClose, onSuccess }: UploadModalProps) {
  const toast = useToast();
  const [tab, setTab] = useState<'upload' | 'template'>('upload');
  const [form, setForm] = useState({ title: '', client_name: '', client_email: '', crm_identifier: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setStatus('Uploading PDF...');

    const { supabase } = await import('@/lib/supabase');

    try {
      // Sanitize filename: remove special chars that Supabase storage rejects
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // ── FIX: use proposals/ prefix so splitProposalPages can find the file ──
      const filePath = `proposals/${Date.now()}-${safeName}`;

      // Step 1: Upload PDF directly to storage (bypasses Vercel 4.5 MB body limit)
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

      setStatus('Creating proposal...');

      // Get current user's name from team_members
      const { data: sessionData } = await supabase.auth.getSession();
      let creatorName: string | null = null;
      if (sessionData?.session?.user?.id) {
        const { data: member } = await supabase
          .from('team_members')
          .select('name')
          .eq('user_id', sessionData.session.user.id)
          .single();
        creatorName = member?.name || null;
      }

      // ── FIX: call /api/proposals instead of direct DB insert so that
      //    splitProposalPages runs and proposal_pages_v2 rows get created ──
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           form.title,
          client_name:     form.client_name,
          client_email:    form.client_email    || null,
          crm_identifier:  form.crm_identifier  || null,
          description:     form.description     || null,
          file_path:       filePath,
          file_size_bytes: file.size,
          company_id:      companyId,
          created_by_name: creatorName,
          prepared_by:     creatorName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error: ${res.status}`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setStatus('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-gray-900">
            New Proposal
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'upload'
                ? 'text-teal border-b-2 border-teal -mb-px'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Upload size={15} />
            Upload PDF
          </button>
          <button
            onClick={() => setTab('template')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'template'
                ? 'text-teal border-b-2 border-teal -mb-px'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <LayoutTemplate size={15} />
            From Template
          </button>
        </div>

        {tab === 'upload' ? (
          <form onSubmit={handleUpload} className="p-6 space-y-4">
            <FormFields
              fields={fieldsByType.proposal}
              values={form}
              onChange={(key, value) => setForm({ ...form, [key]: value })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-teal/40 hover:bg-teal/5 transition-colors">
                {file ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FileText size={20} className="text-teal" />
                    <span className="font-medium text-gray-900">{file.name}</span>
                    <span className="text-gray-400">({formatSize(file.size)})</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={24} className="text-gray-300" />
                    <span className="text-sm text-gray-400">Click to upload PDF</span>
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
                  <span className="text-gray-500">{status || 'Uploading...'}</span>
                  {status === 'Uploading PDF...' && (
                    <span className="text-teal font-medium">{uploadProgress}%</span>
                  )}
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal rounded-full transition-all duration-300 ease-out"
                    style={{ width: status === 'Uploading PDF...' ? `${uploadProgress}%` : '100%' }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full bg-teal text-white py-3 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Creating proposal...' : 'Create Proposal'}
            </button>
          </form>
        ) : (
          <div className="p-6">
            <CreateFromTemplate
              companyId={companyId}
              onBack={() => setTab('upload')}
              onSuccess={() => { onSuccess(); onClose(); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}