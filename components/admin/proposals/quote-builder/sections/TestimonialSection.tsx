// components/admin/proposals/quote-builder/sections/TestimonialSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Quote } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
  };
}

export default function TestimonialSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [text, setText] = useState(extras.testimonial);
  const [author, setAuthor] = useState(extras.testimonial_author);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

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
      // Parse out the trailing "— Name, Suburb" if present. The /s flag
      // would let . match newlines, but it's only es2018+, so split the
      // body and tail manually instead.
      const raw: string = (json.text || '').trim();
      const dashIdx = Math.max(raw.lastIndexOf('—'), raw.lastIndexOf('--'));
      if (dashIdx > 0) {
        setText(raw.slice(0, dashIdx).trim().replace(/^"|"$/g, ''));
        setAuthor(raw.slice(dashIdx).trim());
      } else {
        setText(raw.replace(/^"|"$/g, ''));
      }
    } catch {
      toast.error('Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SectionCard
      title="Customer Testimonial"
      description="Optional. A quote from a past customer that builds trust."
      icon={<Quote size={14} className="text-gray-400" />}
      action={
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Generate with AI
        </button>
      }
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder='"They turned up exactly when they said…"'
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y mb-3"
      />
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="— Sarah T., Mosman NSW"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
      />
      <div className="flex items-center justify-end mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </SectionCard>
  );
}
