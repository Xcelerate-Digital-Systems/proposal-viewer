// components/admin/templates/PackageTemplateEditorModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import TierEditor from '@/components/admin/shared/TierEditor';
import type { PackageTier, PackageFeature } from '@/lib/types/packages';
import { supabase } from '@/lib/supabase';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface PackageTemplateEditorModalProps {
  open: boolean;
  onClose: () => void;
  template: { id: string; name: string; description: string | null; tier: PackageTier } | null;
  onSaved: (updated: { id: string; name: string; description: string | null; tier: PackageTier; created_at: string }) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

const DEFAULT_TIER: PackageTier = {
  id: 'new',
  name: 'Package Name',
  price: 0,
  price_prefix: 'FROM',
  price_suffix: '/month',
  is_recommended: false,
  highlight_color: null,
  conditions: [],
  features: [],
  sort_order: 0,
};

export default function PackageTemplateEditorModal({
  open,
  onClose,
  template,
  onSaved,
}: PackageTemplateEditorModalProps) {
  const toast = useToast();
  const isNew = !template;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<PackageTier>(DEFAULT_TIER);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setDescription(template.description ?? '');
        setTier({ ...template.tier });
      } else {
        setName('');
        setDescription('');
        setTier({ ...DEFAULT_TIER, id: generateId() });
      }
      setDirty(false);
    }
  }, [open, template]);

  const updateTier = useCallback((changes: Partial<PackageTier>) => {
    setTier((prev) => ({ ...prev, ...changes }));
    setDirty(true);
  }, []);

  const save = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setSaving(true);
    try {
      const url = template
        ? `/api/package-templates/${template.id}`
        : '/api/package-templates';
      const method = template ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: await authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          tier,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(template ? 'Package updated' : 'Package created');
      onSaved(json.template);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New package template' : 'Edit package template'}
      size="lg"
    >
      <Modal.Body className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-prose mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              placeholder="e.g. Local SEO Bronze"
              className="w-full px-2.5 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-prose mb-1.5">
              Description <span className="text-faint font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
              placeholder="Short description…"
              className="w-full px-2.5 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
          </div>
        </div>

        <TierEditor
          tier={tier}
          tierIdx={0}
          totalTiers={1}
          isExpanded={true}
          onToggleExpand={() => {}}
          onUpdate={updateTier}
          onToggleRecommended={() => updateTier({ is_recommended: !tier.is_recommended })}
          onMove={() => {}}
          onDuplicate={() => {}}
          onRemove={() => {}}
          onAddFeature={() =>
            updateTier({
              features: [...tier.features, { bold_prefix: null, text: '', children: [] }],
            })
          }
          onUpdateFeature={(fi, changes) => {
            const next = tier.features.map((f, i) => (i === fi ? { ...f, ...changes } : f));
            updateTier({ features: next });
          }}
          onRemoveFeature={(fi) =>
            updateTier({ features: tier.features.filter((_, i) => i !== fi) })
          }
          onAddCondition={() =>
            updateTier({ conditions: [...tier.conditions, ''] })
          }
          onUpdateCondition={(ci, val) => {
            const next = [...tier.conditions];
            next[ci] = val;
            updateTier({ conditions: next });
          }}
          onRemoveCondition={(ci) =>
            updateTier({ conditions: tier.conditions.filter((_, i) => i !== ci) })
          }
          onAddChild={(fi) => {
            const next = tier.features.map((f, i) =>
              i === fi ? { ...f, children: [...(f.children ?? []), ''] } : f,
            );
            updateTier({ features: next });
          }}
          onUpdateChild={(fi, ci, val) => {
            const next = tier.features.map((f, i) => {
              if (i !== fi) return f;
              const ch = [...(f.children ?? [])];
              ch[ci] = val;
              return { ...f, children: ch };
            });
            updateTier({ features: next });
          }}
          onRemoveChild={(fi, ci) => {
            const next = tier.features.map((f, i) => {
              if (i !== fi) return f;
              return { ...f, children: (f.children ?? []).filter((_, j) => j !== ci) };
            });
            updateTier({ features: next });
          }}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          leftIcon={Save}
          loading={saving}
          disabled={saving}
          onClick={save}
        >
          {isNew ? 'Create' : 'Save Changes'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
