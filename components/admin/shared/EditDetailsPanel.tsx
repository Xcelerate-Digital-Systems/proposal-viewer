// components/admin/shared/EditDetailsPanel.tsx
'use client';

import { useState } from 'react';
import { Info, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType, type EntityType } from '@/components/ui/FormField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { Button } from '@/components/ui/Button';

const tableByType: Record<EntityType, string> = {
  proposal: 'proposals',
  template: 'proposal_templates',
  document: 'documents',
};

interface EditDetailsPanelProps {
  type: EntityType;
  id: string;
  initialValues: Record<string, string | null>;
  onSave: () => void;
  onCancel?: () => void;
  /** Field keys to hide (e.g. job fields when company toggle is off) */
  hiddenFields?: string[];
}

export default function EditDetailsPanel({ type, id, initialValues, onSave, onCancel, hiddenFields }: EditDetailsPanelProps) {
  const toast = useToast();
  const allFields = fieldsByType[type];
  const fields = hiddenFields?.length
    ? allFields.filter((f) => !hiddenFields.includes(f.key))
    : allFields;
  const [form, setForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = initialValues[f.key] || '';
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    // Validate required fields
    for (const f of fields) {
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const f of fields) {
        payload[f.key] = form[f.key]?.trim() || null;
      }

      const { error } = await supabase
        .from(tableByType[type])
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      toast.success('Details updated');
      onSave();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = fields.some((f) => (form[f.key] || '') !== (initialValues[f.key] || ''));

  return (
    <SectionCard
      title="Details"
      description={`Core information about this ${type}.`}
      icon={<Info size={14} className="text-faint" />}
    >
      <div className="space-y-4">
        <FormFields
          fields={fields}
          values={form}
          onChange={update}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            leftIcon={Save}
            loading={saving}
            disabled={saving || !hasChanges}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}