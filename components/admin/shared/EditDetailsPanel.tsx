// components/admin/shared/EditDetailsPanel.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { FormFields, fieldsByType, type EntityType } from '@/components/ui/FormField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import { useEditorUndo } from '@/components/admin/EditorUndoContext';

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

export default function EditDetailsPanel({ type, id, initialValues, onSave, hiddenFields }: EditDetailsPanelProps) {
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undo = useEditorUndo();
  const lastSavedRef = useRef<Record<string, string>>({ ...form });

  const persist = useCallback(
    async (next: Record<string, string>) => {
      setSaveStatus('saving');
      const prev = { ...lastSavedRef.current };
      try {
        const payload: Record<string, string | null> = {};
        for (const f of fields) {
          payload[f.key] = next[f.key]?.trim() || null;
        }

        const { error } = await supabase
          .from(tableByType[type])
          .update(payload)
          .eq('id', id);

        if (error) throw error;

        undo?.push('Edit details', () => {
          setForm(prev);
          lastSavedRef.current = { ...prev };
          setSaveStatus('saving');
          supabase
            .from(tableByType[type])
            .update(
              Object.fromEntries(fields.map((f) => [f.key, prev[f.key]?.trim() || null]))
            )
            .eq('id', id)
            .then(({ error: e }) => {
              if (e) toast.error('Undo failed to save');
              else onSave();
              setSaveStatus(e ? 'idle' : 'saved');
              if (!e) setTimeout(() => setSaveStatus('idle'), 2000);
            });
        });

        lastSavedRef.current = { ...next };
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        onSave();
      } catch {
        setSaveStatus('idle');
        toast.error('Failed to save details');
      }
    },
    [id, type, fields, toast, onSave, undo],
  );

  const schedule = useCallback(
    (next: Record<string, string>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => persist(next), 600);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const update = (key: string, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    schedule(next);
  };

  return (
    <SectionCard
      title="Details"
      description={`Core information about this ${type}.`}
      icon={<Info size={14} className="text-faint" />}
    >
      <FormFields
        fields={fields}
        values={form}
        onChange={update}
      />
    </SectionCard>
  );
}
