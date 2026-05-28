// components/admin/proposals/quote-builder/sections/TermsSection.tsx
'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras, DEFAULT_QUOTE_TERMS } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function TermsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [text, setText] = useState(extras.terms);
  const [saving, setSaving] = useState(false);
  const dirty = text !== extras.terms;

  const save = async () => {
    setSaving(true);
    const next = { ...extras, terms: text };
    const { error } = await supabase
      .from('proposals')
      .update({ quote_extras: next })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('Terms saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Terms & Conditions"
      description="Appears below the line items on the customer's quote."
      action={
        <button
          type="button"
          onClick={() => setText(DEFAULT_QUOTE_TERMS)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      }
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => dirty && save()}
        rows={6}
        placeholder="Payment is due within…"
        className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y"
      />
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-faint">{text.length} characters</span>
        <Button
          type="button"
          size="sm"
          loading={saving}
          disabled={!dirty}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </SectionCard>
  );
}
