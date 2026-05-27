'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface CreateReviewProjectModalProps {
  companyId: string;
  userId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateFeedbackProjectModal({
  companyId,
  userId,
  onClose,
  onSuccess,
}: CreateReviewProjectModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    const { data: created, error } = await supabase
      .from('review_projects')
      .insert({
        company_id: companyId,
        title: title.trim(),
        description: description.trim() || null,
        client_company: clientCompany.trim() || null,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error || !created) {
      toast.error('Failed to create campaign');
      setSaving(false);
      return;
    }

    // Add the creator as the first project assignee so they receive
    // notifications by default.
    if (userId) {
      const { data: tm } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (tm?.id) {
        await supabase
          .from('review_project_assignees')
          .upsert(
            { review_project_id: created.id, team_member_id: tm.id },
            { onConflict: 'review_project_id,team_member_id' }
          );
      }
    }

    toast.success('Campaign created');
    onSuccess();
    onClose();
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
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="contact@example.com"
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving} disabled={!title.trim()}>
            Create Campaign
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
