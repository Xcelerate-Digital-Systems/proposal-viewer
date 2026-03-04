// components/admin/shared/EditDetailsPanel.tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType, type EntityType } from '@/components/ui/FormField';

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
}

export default function EditDetailsPanel({ type, id, initialValues, onSave, onCancel }: EditDetailsPanelProps) {
  const toast = useToast();
  const fields = fieldsByType[type];
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <FormFields
        fields={fields}
        values={form}
        onChange={update}
      />

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-1.5 px-5 py-2 bg-[#017C87] text-white rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}