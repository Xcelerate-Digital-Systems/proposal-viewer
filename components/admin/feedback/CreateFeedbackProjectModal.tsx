'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useEntitlements } from '@/hooks/useEntitlements';
import { authFetch } from '@/lib/auth-fetch';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import type { ReviewWorkflowTemplate } from '@/lib/types/feedback';
import { FileText, Users, Check } from 'lucide-react';

interface CreateReviewProjectModalProps {
  companyId: string;
  userId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateFeedbackProjectModal({
  companyId,
  userId: _userId,
  onClose,
  onSuccess,
}: CreateReviewProjectModalProps) {
  const toast = useToast();
  const router = useRouter();
  const { check } = useEntitlements(companyId);
  const reviewCheck = check('reviews');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [templates, setTemplates] = useState<ReviewWorkflowTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/api/workflow-templates?company_id=${companyId}`);
        const json = await res.json().catch(() => null);
        if (json?.templates) {
          setTemplates(json.templates);
          // Auto-select the default template
          const defaultTpl = json.templates.find((t: ReviewWorkflowTemplate) => t.is_default);
          if (defaultTpl) setSelectedTemplateId(defaultTpl.id);
        }
      } catch { /* ignore */ }
      setLoadingTemplates(false);
    })();
  }, [companyId]);

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
        client_company: clientCompany.trim() || null,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        template_id: selectedTemplateId || undefined,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.id) {
      toast.error(json?.error || 'Failed to create campaign');
      setSaving(false);
      return;
    }

    toast.success('Campaign created');
    onSuccess();
    onClose();
    router.push(`/campaigns/${json.id}/assets`);
  };

  return (
    <Modal open onClose={onClose} title="New Campaign" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <Modal.Body className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Campaign Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Campaign Creatives"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what's being reviewed..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors resize-none"
            />
          </div>

          {/* Company name — shown as the brand in ad/email previews. */}
          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Company / Brand Name
            </label>
            <input
              type="text"
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
              placeholder="e.g. Premier Shipping Containers"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
            <p className="text-xs text-faint mt-1.5">
              Used as the page name in Meta ad previews and the sender on email previews.
            </p>
          </div>

          {/* Contact row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-prose mb-1.5">
                Contact Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Mia Gordon"
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

          {/* Workflow Template Picker */}
          {!loadingTemplates && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-prose mb-1.5">
                Workflow Template
              </label>
              <div className="space-y-1.5">
                {/* Blank option */}
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId(null)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors flex items-center gap-3 ${
                    !selectedTemplateId
                      ? 'border-teal bg-teal/5'
                      : 'border-edge hover:border-edge-strong'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-faint" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-medium text-ink">Blank campaign</p>
                    <p className="text-xs text-faint">Configure stages and assignees later</p>
                  </div>
                  {!selectedTemplateId && (
                    <Check size={16} className="text-teal shrink-0" />
                  )}
                </button>

                {templates.map((tpl) => {
                  const stageCount = Array.isArray(tpl.stages) ? tpl.stages.length : 0;
                  const memberCount = new Set(
                    (tpl.stages ?? []).flatMap((s) => s.assignee_ids ?? [])
                  ).size;
                  const guestCount = new Set(
                    (tpl.stages ?? []).flatMap((s) => s.guest_emails ?? [])
                  ).size;
                  const selected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors flex items-center gap-3 ${
                        selected
                          ? 'border-teal bg-teal/5'
                          : 'border-edge hover:border-edge-strong'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                        <Users size={14} className="text-teal" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-caption font-medium text-ink truncate">{tpl.name}</p>
                          {tpl.is_default && (
                            <span className="shrink-0 px-1.5 py-0.5 text-2xs font-medium bg-teal/10 text-teal rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-faint truncate">
                          {tpl.description || `${stageCount} stage${stageCount !== 1 ? 's' : ''}${memberCount ? `, ${memberCount} member${memberCount !== 1 ? 's' : ''}` : ''}${guestCount ? `, ${guestCount} guest${guestCount !== 1 ? 's' : ''}` : ''}`}
                        </p>
                      </div>
                      {selected && (
                        <Check size={16} className="text-teal shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {saving && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-dim">Creating campaign...</span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-teal rounded-full animate-progress-indeterminate" />
              </div>
            </div>
          )}
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
            Create Campaign
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
