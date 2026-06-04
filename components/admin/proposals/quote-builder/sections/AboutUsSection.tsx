// components/admin/proposals/quote-builder/sections/AboutUsSection.tsx
'use client';

import { useState } from 'react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras } from '@/lib/types/quote-extras';
import { inputClassName } from '@/components/ui/FormField';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function AboutUsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [text, setText] = useState(extras.about_us);
  const [saving, setSaving] = useState(false);
  const dirty = text !== extras.about_us;

  const save = async () => {
    setSaving(true);
    const next = { ...extras, about_us: text };
    const { error } = await supabase
      .from('proposals')
      .update({ quote_extras: next })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('About Us saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="About Your Business"
      description="A short blurb that appears on the quote. Edit to personalise."
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => dirty && save()}
        rows={5}
        placeholder="We are a fully licensed renovation company with…"
        className={`${inputClassName} resize-y`}
      />
      <div className="flex items-center justify-end mt-3">
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
