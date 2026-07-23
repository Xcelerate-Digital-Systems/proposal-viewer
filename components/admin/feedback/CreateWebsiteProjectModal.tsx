'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useEntitlements } from '@/hooks/useEntitlements';
import { authFetch } from '@/lib/auth-fetch';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

interface CreateWebsiteProjectModalProps {
  companyId: string;
  userId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateWebsiteProjectModal({
  companyId,
  userId: _userId,
  onClose,
  onSuccess,
}: CreateWebsiteProjectModalProps) {
  const toast = useToast();
  const router = useRouter();
  const { check } = useEntitlements(companyId);
  const reviewCheck = check('reviews');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rootDomain, setRootDomain] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!reviewCheck.allowed) {
      toast.error(reviewCheck.message || 'Plan limit reached');
      return;
    }

    setSaving(true);
    const res = await authFetch(`/api/campaigns?company_id=${companyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        project_type: 'website',
        root_domain: rootDomain.trim() || null,
        client_company: clientCompany.trim() || null,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.id) {
      toast.error(json?.error || 'Failed to create website project');
      setSaving(false);
      return;
    }

    toast.success('Website project created');
    onSuccess();
    onClose();
    router.push(`/campaigns/${json.id}/sitemap`);
  };

  return (
    <Modal open onClose={onClose} title="New Website Project" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <Modal.Body className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Website Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Client Website Redesign"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Root Domain
            </label>
            <input
              type="text"
              value={rootDomain}
              onChange={(e) => setRootDomain(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
            <p className="text-xs text-faint mt-1.5">
              The base URL for this website. Page paths will be appended to this domain.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the website project..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Company / Brand Name
            </label>
            <input
              type="text"
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-prose mb-1.5">
                Contact Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prose mb-1.5">
                Contact Email
              </label>
              <ContactAutocomplete
                value={clientEmail}
                onChange={setClientEmail}
                onSelect={(c) => {
                  setClientEmail(c.email);
                  if (c.name && !clientName) setClientName(c.name);
                  if (c.organisation && !clientCompany) setClientCompany(c.organisation);
                }}
                placeholder="contact@example.com"
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={saving}
            disabled={!title.trim() || !reviewCheck.allowed}
            title={reviewCheck.allowed ? undefined : reviewCheck.message}
          >
            Create Website
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
