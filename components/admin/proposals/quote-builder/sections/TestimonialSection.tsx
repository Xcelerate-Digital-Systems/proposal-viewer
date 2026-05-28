// components/admin/proposals/quote-builder/sections/TestimonialSection.tsx
'use client';

import { useState } from 'react';
import { Quote } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function TestimonialSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [text, setText] = useState(extras.testimonial);
  const [author, setAuthor] = useState(extras.testimonial_author);
  const [saving, setSaving] = useState(false);

  const dirty = text !== extras.testimonial || author !== extras.testimonial_author;

  const save = async () => {
    setSaving(true);
    const next = { ...extras, testimonial: text, testimonial_author: author };
    const { error } = await supabase
      .from('proposals')
      .update({ quote_extras: next })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('Testimonial saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Customer Testimonial"
      description="Optional. A quote from a past customer that builds trust."
      icon={<Quote size={14} className="text-faint" />}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => dirty && save()}
        rows={4}
        placeholder='"They turned up exactly when they said…"'
        className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y mb-3"
      />
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        onBlur={() => dirty && save()}
        placeholder="— Sarah T., Mosman NSW"
        className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
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
