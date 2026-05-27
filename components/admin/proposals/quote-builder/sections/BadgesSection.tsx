// components/admin/proposals/quote-builder/sections/BadgesSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { parseQuoteExtras, DEFAULT_QUOTE_BADGES } from '@/lib/types/quote-extras';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

export default function BadgesSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const extras = parseQuoteExtras(proposal.quote_extras);
  const initial = [extras.badges[0] ?? '', extras.badges[1] ?? '', extras.badges[2] ?? ''];
  const [vals, setVals] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  const dirty = vals.some((v, i) => v !== initial[i]);

  const save = async () => {
    setSaving(true);
    const next = {
      ...extras,
      badges: vals.map((v) => v.trim()).filter(Boolean).slice(0, 3),
    };
    const { error } = await supabase
      .from('proposals')
      .update({ quote_extras: next })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('Trust badges saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Trust Badges"
      icon={<ShieldCheck size={14} className="text-faint" />}
      description="Three short reassurances shown under the cover. Leave blank to hide a slot."
      action={
        <button
          type="button"
          onClick={() => setVals([...DEFAULT_QUOTE_BADGES])}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
        >
          <RotateCcw size={12} />
          Reset to defaults
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            type="text"
            value={vals[i]}
            onChange={(e) =>
              setVals((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
            }
            placeholder={DEFAULT_QUOTE_BADGES[i]}
            maxLength={32}
            className="px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
          />
        ))}
      </div>
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
