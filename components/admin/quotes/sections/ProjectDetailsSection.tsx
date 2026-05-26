// components/admin/quotes/sections/ProjectDetailsSection.tsx
// Quote-only Project Details — Title / Category / Valid Until.
// Scope of Works is no longer here; it has its own ScopeOfWorksSection so
// it can sit prominently in the builder, matching QuoteWin's layout.
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { Button } from '@/components/ui/Button';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

// Default validity = +30 days from today. Computed once at module load so the
// user sees a sensible date rather than blank. They can clear it if not needed.
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function QuoteProjectDetailsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(proposal.title ?? '');
  const [category, setCategory] = useState(proposal.category ?? '');
  const [validUntil, setValidUntil] = useState(proposal.valid_until ?? defaultValidUntil());
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== (proposal.title ?? '') ||
    category !== (proposal.category ?? '') ||
    validUntil !== (proposal.valid_until ?? defaultValidUntil());

  const save = async () => {
    if (!title.trim()) {
      toast.error('Quote title is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({
        title: title.trim(),
        category: category.trim() || null,
        valid_until: validUntil || null,
      })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('Project details saved');
      onSaved();
    }
  };

  return (
    <SectionCard title="Project Details">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Quote Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => dirty && save()}
            placeholder="e.g. Full Bathroom Renovation — 12 Oak St"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
          />
          <p className="text-xs text-gray-400 mt-1">
            The main heading shown on the customer&apos;s quote.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={() => dirty && save()}
            placeholder="e.g. Bathroom, Kitchen, Landscaping"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
          />
          <p className="text-xs text-gray-400 mt-1">
            Used internally to filter and group your quotes.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Valid Until</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            onBlur={() => dirty && save()}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
          />
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-gray-100">
          <Button
            type="button"
            size="sm"
            loading={saving}
            disabled={!dirty}
            onClick={save}
          >
            Save Project Details
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
