// components/admin/quotes/sections/ScopeOfWorksSection.tsx
// Scope of Works — the prominent body text describing what's included.
// Stored on proposals.scope_of_works; falls back to the legacy `description`
// field so quotes built with the old builder still render their scope.
'use client';

import { useRef, useState } from 'react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useEditorUndo } from '@/components/admin/EditorUndoContext';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function ScopeOfWorksSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const editorUndo = useEditorUndo();
  const initial = proposal.scope_of_works ?? proposal.description ?? '';
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const snapshotRef = useRef(initial);

  const dirty = value !== initial;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({ scope_of_works: value.trim() || null })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save scope');
    else {
      toast.success('Scope saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Scope of Works"
      description="Describe what's included in this quote. This appears prominently on the customer's quote."
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => { snapshotRef.current = value; }}
        onBlur={() => {
          if (dirty) {
            const prev = snapshotRef.current;
            editorUndo?.push('Scope of works', () => setValue(prev));
            save();
          }
        }}
        rows={6}
        placeholder={
          'Supply and install new shower, vanity, and tapware\n' +
          'Full waterproofing to all wet areas\n' +
          'Floor and wall tiling (client to supply tiles)\n' +
          'Removal and disposal of existing fixtures'
        }
        className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y"
      />
      {saving && (
        <p className="text-detail text-faint text-right pt-3 mt-3 border-t border-edge">Saving…</p>
      )}
    </SectionCard>
  );
}
