'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Star, StarOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { authFetch } from '@/lib/auth-fetch';
import type { ReviewWorkflowTemplate } from '@/lib/types/feedback';
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';

interface Props {
  companyId: string;
  open: boolean;
  onClose: () => void;
}

export default function WorkflowTemplatesManager({ companyId, open, onClose }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<ReviewWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<ReviewWorkflowTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await authFetch(`/api/workflow-templates?company_id=${companyId}`);
      const json = await res.json().catch(() => null);
      if (json?.templates) setTemplates(json.templates);
    } catch { /* ignore */ }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleDelete = async (tpl: ReviewWorkflowTemplate) => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete "${tpl.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const res = await authFetch(`/api/workflow-templates/${tpl.id}?company_id=${companyId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Template deleted');
      fetchTemplates();
    } else {
      toast.error('Failed to delete template');
    }
  };

  const toggleDefault = async (tpl: ReviewWorkflowTemplate) => {
    const res = await authFetch(`/api/workflow-templates/${tpl.id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: !tpl.is_default }),
    });
    if (res.ok) {
      toast.success(tpl.is_default ? 'Default removed' : 'Set as default');
      fetchTemplates();
    } else {
      toast.error('Failed to update template');
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal open onClose={onClose} title="Workflow Templates" size="lg">
        <Modal.Body>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Users size={32} className="mx-auto text-faint mb-3" />
              <p className="text-caption text-dim mb-1">No workflow templates yet</p>
              <p className="text-xs text-faint">
                Save a template from a campaign's settings page to reuse its assignee configuration.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => {
                const stageCount = Array.isArray(tpl.stages) ? tpl.stages.length : 0;
                const memberCount = new Set(
                  (tpl.stages ?? []).flatMap((s) => s.assignee_ids ?? [])
                ).size;
                const guestCount = new Set(
                  (tpl.stages ?? []).flatMap((s) => s.guest_emails ?? [])
                ).size;

                // Get stage labels for display
                const stageLabels = (tpl.stages ?? [])
                  .map((s) => {
                    const cfg = REVIEW_STATUS_CONFIG[s.stage as keyof typeof REVIEW_STATUS_CONFIG];
                    return cfg?.label || s.stage;
                  })
                  .filter((l) => l !== 'all');

                return (
                  <div
                    key={tpl.id}
                    className="flex items-start gap-3 p-4 rounded-xl border border-edge bg-white hover:border-edge-strong transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Users size={15} className="text-teal" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h4 className="text-caption font-medium text-ink truncate">{tpl.name}</h4>
                        {tpl.is_default && (
                          <span className="shrink-0 px-1.5 py-0.5 text-2xs font-medium bg-teal/10 text-teal rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-dim mb-1.5">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-faint">
                        <span>{stageCount} stage{stageCount !== 1 ? 's' : ''}</span>
                        {memberCount > 0 && (
                          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                        )}
                        {guestCount > 0 && (
                          <span>{guestCount} guest{guestCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      {stageLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {stageLabels.map((label, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 text-2xs font-medium bg-surface text-dim rounded-full"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleDefault(tpl)}
                        className="p-1.5 rounded-lg text-faint hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        title={tpl.is_default ? 'Remove default' : 'Set as default'}
                      >
                        {tpl.is_default ? <Star size={14} className="text-amber-500 fill-amber-500" /> : <StarOff size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTemplate(tpl)}
                        className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl)}
                        className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {editingTemplate && (
        <EditTemplateModal
          companyId={companyId}
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </>
  );
}

function EditTemplateModal({
  companyId,
  template,
  onClose,
  onSaved,
}: {
  companyId: string;
  template: ReviewWorkflowTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [saving, setSaving] = useState(false);

  // Due date offsets editing
  const [offsets, setOffsets] = useState<Record<string, number>>(
    template.default_stage_due_offsets || {}
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const res = await authFetch(`/api/workflow-templates/${template.id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        default_stage_due_offsets: offsets,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      toast.error(json?.error || 'Failed to update template');
      setSaving(false);
      return;
    }

    toast.success('Template updated');
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Edit Template" size="md">
      <Modal.Body className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
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
            rows={2}
            className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors resize-none"
          />
        </div>

        {/* Due Date Offsets */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Stage Due Date Offsets
          </label>
          <p className="text-xs text-faint mb-2">
            Days from campaign creation. Leave blank to skip.
          </p>
          <div className="space-y-2">
            {REVIEW_STATUS_ORDER.filter(
              (s) => s !== 'draft' && s !== 'archived'
            ).map((stage) => {
              const def = REVIEW_STATUS_CONFIG[stage];
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${def.dot}`} />
                  <span className="text-caption text-ink w-32 shrink-0">{def.label}</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="--"
                    value={offsets[stage] ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setOffsets((prev) => {
                        const next = { ...prev };
                        if (isNaN(val) || val <= 0) {
                          delete next[stage];
                        } else {
                          next[stage] = val;
                        }
                        return next;
                      });
                    }}
                    className="w-20 px-2.5 py-1.5 bg-surface rounded-lg text-sm text-ink text-center focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
                  />
                  <span className="text-xs text-faint">days</span>
                </div>
              );
            })}
          </div>
        </div>
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
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
