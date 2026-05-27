// components/admin/proposals/quote-builder/sections/TestimonialSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, Quote, Sparkles } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
  };
}

/** Pull "— Name, Suburb" out of a generated testimonial blob so the author
 *  field stays separate from the quote text the user sees. */
function splitTestimonial(text: string): { body: string; author: string } {
  const m = text.match(/[—-]\s*([^\n]+)$/);
  if (!m) return { body: text.trim(), author: '' };
  const author = m[1].trim();
  const body = text.slice(0, m.index).trim();
  return { body, author };
}

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
  const [generating, setGenerating] = useState(false);

  const dirty = text !== extras.testimonial || author !== extras.testimonial_author;

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ kind: 'testimonial', projectTitle: proposal.title }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const split = splitTestimonial(json.text || '');
      setText(split.body);
      if (split.author) setAuthor(split.author);
    } catch {
      toast.error('Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

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
      action={
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-accent-ai bg-accent-ai-tint hover:bg-accent-ai-tint-hover transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Generate with AI
        </button>
      }
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
