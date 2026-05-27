// components/admin/proposals/quote-builder/sections/TermsSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras, DEFAULT_QUOTE_TERMS } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
  };
}

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function TermsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [text, setText] = useState(extras.terms);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const dirty = text !== extras.terms;

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ kind: 'terms', projectTitle: proposal.title }),
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-accent-ai bg-accent-ai-tint hover:bg-accent-ai-tint-hover transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate with AI
          </button>
          <button
            type="button"
            onClick={() => setText(DEFAULT_QUOTE_TERMS)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
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
