// components/admin/quotes/sections/ScopeOfWorksSection.tsx
// Scope of Works — the prominent body text describing what's included.
// Stored on proposals.scope_of_works; falls back to the legacy `description`
// field so quotes built with the old builder still render their scope.
'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
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

export default function ScopeOfWorksSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  // Prefer the new column; fall back to legacy `description` until next save.
  const initial = proposal.scope_of_works ?? proposal.description ?? '';
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const dirty = value !== initial;

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          kind: 'scope',
          projectTitle: proposal.title,
          category: proposal.category,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setValue(json.text || '');
      toast.success('Scope generated — review and save');
    } catch {
      toast.error('Failed to generate scope');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({ scope_of_works: value.trim() || null })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save scope');
    else {
      toast.success('Scope saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Scope of Works"
      description="Describe what's included in this quote. This appears prominently on the customer's quote."
      action={
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-accent-ai bg-accent-ai-tint hover:bg-accent-ai-tint-hover transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Generate with AI
        </button>
      }
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => dirty && save()}
        rows={6}
        placeholder={
          'Supply and install new shower, vanity, and tapware\n' +
          'Full waterproofing to all wet areas\n' +
          'Floor and wall tiling (client to supply tiles)\n' +
          'Removal and disposal of existing fixtures'
        }
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y"
      />
      <div className="flex items-center justify-end pt-3 mt-3 border-t border-gray-100">
        <Button
          type="button"
          size="sm"
          loading={saving}
          disabled={!dirty}
          onClick={save}
        >
          Save Scope
        </Button>
      </div>
    </SectionCard>
  );
}
