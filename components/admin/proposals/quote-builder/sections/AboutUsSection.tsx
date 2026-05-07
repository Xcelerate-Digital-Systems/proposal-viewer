// components/admin/proposals/quote-builder/sections/AboutUsSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
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

export default function AboutUsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [text, setText] = useState(extras.about_us);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ kind: 'about', projectTitle: proposal.title }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setText(json.text || '');
    } catch {
      toast.error('Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SectionCard
      title="About Your Business"
      description="A short blurb that appears on the quote. Edit to personalise."
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
        rows={5}
        placeholder="We are a fully licensed renovation company with…"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y"
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
