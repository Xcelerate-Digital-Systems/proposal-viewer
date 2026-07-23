'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Figma } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useEntitlements } from '@/hooks/useEntitlements';
import { authFetch } from '@/lib/auth-fetch';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

type WebsiteSource = 'website' | 'figma';

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
  const [source, setSource] = useState<WebsiteSource>('website');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rootDomain, setRootDomain] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
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
        root_domain: source === 'website' ? (rootDomain.trim() || null) : null,
        figma_url: source === 'figma' ? (figmaUrl.trim() || null) : null,
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

          {/* Source toggle */}
          <div>
            <label className="block text-sm font-medium text-prose mb-2">
              What are you reviewing?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSource('website')}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  source === 'website'
                    ? 'border-teal bg-teal/5 ring-2 ring-teal/20'
                    : 'border-edge bg-surface hover:border-edge-strong'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  source === 'website' ? 'bg-teal/10' : 'bg-surface'
                }`}>
                  <Globe size={18} className={source === 'website' ? 'text-teal' : 'text-faint'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${source === 'website' ? 'text-ink' : 'text-dim'}`}>
                    Live / Staging Site
                  </p>
                  <p className="text-xs text-faint">Review a website URL</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSource('figma')}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  source === 'figma'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-edge bg-surface hover:border-edge-strong'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  source === 'figma' ? 'bg-purple-100' : 'bg-surface'
                }`}>
                  <Figma size={18} className={source === 'figma' ? 'text-purple-600' : 'text-faint'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${source === 'figma' ? 'text-ink' : 'text-dim'}`}>
                    Figma Design
                  </p>
                  <p className="text-xs text-faint">Review a Figma file</p>
                </div>
              </button>
            </div>
          </div>

          {/* Dynamic field based on source */}
          {source === 'website' ? (
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
          ) : (
            <div>
              <label className="block text-sm font-medium text-prose mb-1.5">
                Figma File URL
              </label>
              <input
                type="url"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/abc123/..."
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
              <p className="text-xs text-faint mt-1.5">
                The Figma file containing your website designs. Pages will be linked to individual frames.
              </p>
            </div>
          )}

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
