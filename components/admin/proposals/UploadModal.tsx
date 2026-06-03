// components/admin/proposals/UploadModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { authedFetch } from '@/lib/api-fetch';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import CreateFromTemplate from './CreateFromTemplate';

interface UploadModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: 'upload' | 'template' | 'blank' | 'quote' | 'quote-template';
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const modalTitles = {
  upload:           'New Pitch',
  template:         'New Pitch from Template',
  blank:            'Blank Pitch',
  quote:            'New Quote',
  'quote-template': 'New Quote from Template',
};

export default function UploadModal({ companyId, onClose, onSuccess, initialTab = 'upload' }: UploadModalProps) {
  const router = useRouter();
  const toast = useToast();
  const mode = initialTab;
  const [form, setForm] = useState({ title: '', client_name: '', client_email: '', crm_identifier: '', description: '' });
  const [blankForm, setBlankForm] = useState({ title: '', client_name: '', client_email: '' });
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

      const res = await authedFetch('/api/proposals', {
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

  const handleCreateBlank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blankForm.title || !blankForm.client_name) return;
    setUploading(true);
    setStatus('Creating pitch...');

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

      const res = await authedFetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           blankForm.title,
          client_name:     blankForm.client_name,
          client_email:    blankForm.client_email || null,
          company_id:      companyId,
          created_by_name: creatorName,
          prepared_by:     creatorName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error: ${res.status}`);
      }

      const data = await res.json();
      onSuccess();
      onClose();
      router.push(`/proposals/${data.proposal_id}/pages`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create pitch. Please try again.');
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

      const res = await authedFetch('/api/proposals', {
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
      router.push(`/quotes/${data.proposal_id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create quote. Please try again.');
    } finally {
      setUploading(false);
      setStatus('');
    }
  };

  // Prevent accidental dismiss while a file is uploading or a quote is being
  // created — match the protective pattern Phase 5 added to TemplateUploadModal.
  const lockClose = uploading;

  return (
    <Modal
      open
      onClose={onClose}
      title={modalTitles[mode]}
      size="lg"
      closeOnBackdrop={!lockClose}
      closeOnEscape={!lockClose}
    >
      {mode === 'upload' && (
        <form onSubmit={handleUpload} className="flex flex-col min-h-0 flex-1">
          <Modal.Body className="space-y-4">
            <FormFields
              fields={fieldsByType.proposal.filter((f) => f.key !== 'client_email')}
              values={form}
              onChange={(key, value) => setForm({ ...form, [key]: value })}
            />
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Client Email <span className="text-faint font-normal">(optional)</span>
              </label>
              <ContactAutocomplete
                value={form.client_email}
                onChange={(v) => setForm({ ...form, client_email: v })}
                onSelect={(c) => {
                  setForm((prev) => ({
                    ...prev,
                    client_email: c.email,
                    client_name: c.name && !prev.client_name ? c.name : prev.client_name,
                  }));
                }}
                placeholder="john@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-edge-strong bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-faint"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prose mb-1">PDF File</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-edge-hover rounded-2xl cursor-pointer hover:border-teal/40 hover:bg-teal/5 transition-colors">
                {file ? (
                  <div className="flex items-center gap-2 text-sm text-dim">
                    <FileText size={20} className="text-teal" />
                    <span className="font-medium text-ink">{file.name}</span>
                    <span className="text-faint">({formatSize(file.size)})</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={24} className="text-faint" />
                    <span className="text-sm text-faint">Click to upload PDF</span>
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
                  <span className="text-dim">{status || 'Uploading...'}</span>
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
          </Modal.Body>
          <Modal.Footer>
            <Button type="submit" fullWidth loading={uploading} disabled={!file}>
              Create Proposal
            </Button>
          </Modal.Footer>
        </form>
      )}

      {mode === 'template' && (
        <Modal.Body>
          <CreateFromTemplate
            companyId={companyId}
            entityType="proposal"
            onBack={onClose}
            onSuccess={() => { onSuccess(); onClose(); }}
          />
        </Modal.Body>
      )}

      {mode === 'blank' && (
        <form onSubmit={handleCreateBlank} className="flex flex-col min-h-0 flex-1">
          <Modal.Body className="space-y-4">
            <p className="text-sm text-dim">
              Start from scratch — add pages, text, quotes, and import content from your templates.
            </p>
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Pitch Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={blankForm.title}
                onChange={(e) => setBlankForm({ ...blankForm, title: e.target.value })}
                placeholder="e.g. Website Redesign Proposal"
                required
                autoFocus
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={blankForm.client_name}
                onChange={(e) => setBlankForm({ ...blankForm, client_name: e.target.value })}
                placeholder="e.g. Acme Corp"
                required
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Client Email <span className="text-faint font-normal">(optional)</span>
              </label>
              <ContactAutocomplete
                value={blankForm.client_email}
                onChange={(v) => setBlankForm({ ...blankForm, client_email: v })}
                onSelect={(c) => {
                  setBlankForm((prev) => ({
                    ...prev,
                    client_email: c.email,
                    client_name: c.name && !prev.client_name ? c.name : prev.client_name,
                  }));
                }}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dim">{status || 'Creating...'}</span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-teal rounded-full animate-progress-indeterminate" />
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="submit"
              fullWidth
              loading={uploading}
              disabled={!blankForm.title || !blankForm.client_name}
            >
              Create Pitch
            </Button>
          </Modal.Footer>
        </form>
      )}

      {mode === 'quote-template' && (
        <Modal.Body>
          <CreateFromTemplate
            companyId={companyId}
            entityType="quote"
            onBack={onClose}
            onSuccess={() => { onSuccess(); onClose(); }}
          />
        </Modal.Body>
      )}

      {mode === 'quote' && (
        <form onSubmit={handleCreateQuote} className="flex flex-col min-h-0 flex-1">
          <Modal.Body className="space-y-4">
            <p className="text-sm text-dim">
              Create a quick quote to send pricing to a client. You can add line items and payment terms after creation.
            </p>
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Quote Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={quoteForm.title}
                onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })}
                placeholder="e.g. Website Redesign Quote"
                required
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={quoteForm.client_name}
                onChange={(e) => setQuoteForm({ ...quoteForm, client_name: e.target.value })}
                placeholder="e.g. Acme Corp"
                required
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prose mb-1">
                Client Email <span className="text-faint font-normal">(optional)</span>
              </label>
              <ContactAutocomplete
                value={quoteForm.client_email}
                onChange={(v) => setQuoteForm({ ...quoteForm, client_email: v })}
                onSelect={(c) => {
                  setQuoteForm((prev) => ({
                    ...prev,
                    client_email: c.email,
                    client_name: c.name && !prev.client_name ? c.name : prev.client_name,
                  }));
                }}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dim">{status || 'Creating...'}</span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-teal rounded-full animate-progress-indeterminate" />
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="submit"
              fullWidth
              loading={uploading}
              disabled={!quoteForm.title || !quoteForm.client_name}
            >
              Create Quote
            </Button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
}
