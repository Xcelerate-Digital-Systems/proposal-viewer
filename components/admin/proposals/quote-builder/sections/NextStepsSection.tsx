// components/admin/proposals/quote-builder/sections/NextStepsSection.tsx
'use client';

import { useState } from 'react';
import { RotateCcw, ListOrdered, Plus, X } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras, DEFAULT_QUOTE_NEXT_STEPS } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function NextStepsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const [steps, setSteps] = useState<string[]>([...extras.next_steps]);
  const [saving, setSaving] = useState(false);

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
      icon={<ListOrdered size={14} className="text-faint" />}
      description="Numbered list shown above the accept form. Up to four steps."
      action={
        <button
          type="button"
          onClick={() => setSteps([...DEFAULT_QUOTE_NEXT_STEPS])}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      }
    >
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-medium text-faint w-6 shrink-0 tabular-nums">
              0{i + 1}
            </span>
            <input
              type="text"
              value={step}
              onChange={(e) =>
                setSteps((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
              }
              placeholder={DEFAULT_QUOTE_NEXT_STEPS[i] ?? 'Add a step…'}
              className="flex-1 px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
            <button
              type="button"
              onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={steps.length <= 1}
              className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
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
          className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
        >
          <Plus size={12} />
          Add step
        </button>
      )}
      <div className="flex items-center justify-end mt-3 pt-3 border-t border-edge">
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
