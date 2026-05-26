// components/admin/proposals/quote-builder/sections/NextStepsSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, ListOrdered, Plus, X, Sparkles } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras, DEFAULT_QUOTE_NEXT_STEPS } from '@/lib/types/quote-extras';
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

export default function NextStepsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [steps, setSteps] = useState<string[]>([...extras.next_steps]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ kind: 'next_steps', projectTitle: proposal.title }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const lines = String(json.text || '')
        .split('\n')
        .map((l) => l.replace(/^[\s\d.)>•-]+/, '').trim())
        .filter(Boolean)
        .slice(0, 4);
      if (lines.length) setSteps(lines);
    } catch {
      toast.error('Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const dirty =
    steps.length !== extras.next_steps.length ||
    steps.some((s, i) => s !== extras.next_steps[i]);

  const save = async () => {
    setSaving(true);
    const next = {
      ...extras,
      next_steps: steps.map((s) => s.trim()).filter(Boolean).slice(0, 4),
    };
    const { error } = await supabase
      .from('proposals')
      .update({ quote_extras: next })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('Next steps saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Next Steps"
      icon={<ListOrdered size={14} className="text-gray-400" />}
      description="Numbered list shown above the accept form. Up to four steps."
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate with AI
          </button>
          <button
            type="button"
            onClick={() => setSteps([...DEFAULT_QUOTE_NEXT_STEPS])}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 w-6 shrink-0 tabular-nums">
              0{i + 1}
            </span>
            <input
              type="text"
              value={step}
              onChange={(e) =>
                setSteps((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
              }
              placeholder={DEFAULT_QUOTE_NEXT_STEPS[i] ?? 'Add a step…'}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
            <button
              type="button"
              onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={steps.length <= 1}
              className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
              title="Remove step"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      {steps.length < 4 && (
        <button
          type="button"
          onClick={() => setSteps((prev) => [...prev, ''])}
          className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-md text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
        >
          <Plus size={12} />
          Add step
        </button>
      )}
      <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100">
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
