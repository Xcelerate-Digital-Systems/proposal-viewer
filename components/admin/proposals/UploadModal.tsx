// components/admin/proposals/UploadModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType } from '@/components/ui/FormField';
import CreateFromTemplate from './CreateFromTemplate';

interface UploadModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: 'upload' | 'template' | 'quote' | 'quote-template';
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const modalTitles = {
  upload:           'New Proposal',
  template:         'New Proposal from Template',
  quote:            'New Quote',
  'quote-template': 'New Quote from Template',
};

export default function UploadModal({ companyId, onClose, onSuccess, initialTab = 'upload' }: UploadModalProps) {
  const router = useRouter();
  const toast = useToast();
  const mode = initialTab;
  const [form, setForm] = useState({ title: '', client_name: '', client_email: '', crm_identifier: '', description: '' });
  const [quoteForm, setQuoteForm] = useState({ title: '', client_name: '', client_email: '' });
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
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `proposals/${Date.now()}-${safeName}`;

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

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.title || !quoteForm.client_name) return;
    setUploading(true);
    setStatus('Creating quote...');

    const { supabase } = await import('@/lib/supabase');

    try {
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

      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           quoteForm.title,
          client_name:     quoteForm.client_name,
          client_email:    quoteForm.client_email || null,
          company_id:      companyId,
          created_by_name: creatorName,
          prepared_by:     creatorName,
          entity_type:     'quote',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error: ${res.status}`);
      }

      const data = await res.json();
      onSuccess();
      onClose();
      router.push(`/proposals/${data.proposal_id}/quote-pricing`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create quote. Please try again.');
    } finally {
      setUploading(false);
      setStatus('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_rgba(20,20,40,0.18)] w-full max-w-lg border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-gray-900">
            {modalTitles[mode]}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content — no tabs, just the right form */}
        {mode === 'upload' && (
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
        )}

        {mode === 'template' && (
          <div className="p-6">
            <CreateFromTemplate
              companyId={companyId}
              entityType="proposal"
              onBack={onClose}
              onSuccess={() => { onSuccess(); onClose(); }}
            />
          </div>
        )}

        {mode === 'quote-template' && (
          <div className="p-6">
            <CreateFromTemplate
              companyId={companyId}
              entityType="quote"
              onBack={onClose}
              onSuccess={() => { onSuccess(); onClose(); }}
            />
          </div>
        )}

        {mode === 'quote' && (
          <form onSubmit={handleCreateQuote} className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Create a quick quote to send pricing to a client. You can add line items and payment terms after creation.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quote Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={quoteForm.title}
                onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })}
                placeholder="e.g. Website Redesign Quote"
                required
                className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 "
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={quoteForm.client_name}
                onChange={(e) => setQuoteForm({ ...quoteForm, client_name: e.target.value })}
                placeholder="e.g. Acme Corp"
                required
                className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 "
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={quoteForm.client_email}
                onChange={(e) => setQuoteForm({ ...quoteForm, client_email: e.target.value })}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 "
              />
            </div>
            <button
              type="submit"
              disabled={uploading || !quoteForm.title || !quoteForm.client_name}
              className="w-full bg-teal text-white py-3 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Creating quote...' : 'Create Quote'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
