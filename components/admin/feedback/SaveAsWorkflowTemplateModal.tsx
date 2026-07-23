'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { authFetch } from '@/lib/auth-fetch';
import type { WorkflowTemplateStage } from '@/lib/types/feedback';

interface Props {
  companyId: string;
  projectId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SaveAsWorkflowTemplateModal({
  companyId,
  projectId,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      // Fetch current assignees and guests for this project
      const [assigneesRes, guestsRes] = await Promise.all([
        authFetch(`/api/campaigns/${projectId}/assignees?company_id=${companyId}`),
        authFetch(`/api/campaigns/${projectId}/guests?company_id=${companyId}`),
      ]);

      const assigneesData = await assigneesRes.json().catch(() => null);
      const guestsData = await guestsRes.json().catch(() => null);

      const assignees: { team_member_id: string; stages: string[] }[] =
        assigneesData?.assignees ?? [];
      const guests: { email: string; stages: string[]; removed?: boolean }[] =
        (guestsData?.guests ?? []).filter((g: { removed?: boolean }) => !g.removed);

      // Build per-stage template data
      const stageMap = new Map<string, { assignee_ids: Set<string>; guest_emails: Set<string> }>();

      for (const a of assignees) {
        const memberStages = a.stages?.length ? a.stages : ['all'];
        for (const s of memberStages) {
          if (!stageMap.has(s)) stageMap.set(s, { assignee_ids: new Set(), guest_emails: new Set() });
          stageMap.get(s)!.assignee_ids.add(a.team_member_id);
        }
      }

      for (const g of guests) {
        const guestStages = g.stages?.length ? g.stages : ['all'];
        for (const s of guestStages) {
          if (!stageMap.has(s)) stageMap.set(s, { assignee_ids: new Set(), guest_emails: new Set() });
          stageMap.get(s)!.guest_emails.add(g.email);
        }
      }

      const stages: WorkflowTemplateStage[] = Array.from(stageMap.entries()).map(([stage, data]) => ({
        stage,
        assignee_ids: Array.from(data.assignee_ids),
        guest_emails: Array.from(data.guest_emails),
      }));

      const res = await authFetch(`/api/workflow-templates?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          stages,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Failed to save template');
        setSaving(false);
        return;
      }

      toast.success('Template saved');
      onSaved?.();
      onClose();
    } catch {
      toast.error('Failed to save template');
    }

    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="Save as Workflow Template" size="md">
      <Modal.Body className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Template Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Review Workflow"
            className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this workflow..."
            rows={2}
            className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors resize-none"
          />
        </div>
        <p className="text-xs text-faint">
          This will save the current stage assignees (team members and guests) as a reusable template.
          When creating a new campaign, you can select this template to pre-fill the assignee configuration.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          loading={saving}
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          Save Template
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
