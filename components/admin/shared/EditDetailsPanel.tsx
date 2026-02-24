// components/admin/shared/EditDetailsPanel.tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

type EntityType = 'proposal' | 'template' | 'document';

interface FieldConfig {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'email' | 'textarea';
  placeholder?: string;
  optional?: boolean;
  half?: boolean;
}

const fieldsByType: Record<EntityType, FieldConfig[]> = {
  proposal: [
    { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Website Redesign Proposal' },
    { key: 'client_name', label: 'Client Name', required: true, placeholder: 'John Smith', half: true },
    { key: 'client_email', label: 'Client Email', type: 'email', placeholder: 'john@example.com', optional: true, half: true },
    { key: 'crm_identifier', label: 'CRM Identifier', placeholder: 'e.g. GHL contact ID', optional: true },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief note about this proposal...', optional: true },
  ],
  template: [
    { key: 'name', label: 'Template Name', required: true, placeholder: 'e.g. Standard Proposal Template' },
    { key: 'description', label: 'Description', placeholder: 'Brief description of this template', optional: true },
  ],
  document: [
    { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Capabilities Statement' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief note about this document...', optional: true },
  ],
};

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
  onCancel: () => void;
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

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400';

  // Group fields: half-width fields get paired together
  const renderFields = () => {
    const result: React.ReactNode[] = [];
    let i = 0;
    while (i < fields.length) {
      const f = fields[i];
      // Check if this and next field are both half-width
      if (f.half && i + 1 < fields.length && fields[i + 1].half) {
        const f2 = fields[i + 1];
        result.push(
          <div key={`${f.key}-${f2.key}`} className="grid grid-cols-2 gap-3">
            {renderField(f)}
            {renderField(f2)}
          </div>
        );
        i += 2;
      } else {
        result.push(<div key={f.key}>{renderField(f)}</div>);
        i += 1;
      }
    }
    return result;
  };

  const renderField = (f: FieldConfig) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {f.label}
        {f.optional && <span className="text-gray-400 font-normal"> (optional)</span>}
      </label>
      {f.type === 'textarea' ? (
        <textarea
          value={form[f.key]}
          onChange={(e) => update(f.key, e.target.value)}
          rows={2}
          placeholder={f.placeholder}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={f.type || 'text'}
          required={f.required}
          value={form[f.key]}
          onChange={(e) => update(f.key, e.target.value)}
          placeholder={f.placeholder}
          className={inputClass}
        />
      )}
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {renderFields()}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
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