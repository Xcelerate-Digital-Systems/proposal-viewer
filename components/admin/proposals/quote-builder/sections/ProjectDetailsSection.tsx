// components/admin/proposals/quote-builder/sections/ProjectDetailsSection.tsx
'use client';

import { useState } from 'react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { inputClassName } from '@/components/ui/FormField';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface ProjectDetailsSectionProps {
  proposal: Proposal;
  onSaved: () => void;
}

export default function ProjectDetailsSection({
  proposal,
  onSaved,
}: ProjectDetailsSectionProps) {
  const toast = useToast();
  const [title, setTitle] = useState(proposal.title ?? '');
  const [description, setDescription] = useState(proposal.description ?? '');
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== (proposal.title ?? '') ||
    description !== (proposal.description ?? '');

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
        description: description.trim() || null,
      })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
    } else {
      toast.success('Project details saved');
      onSaved();
    }
  };

  return (
    <SectionCard title="Project Details">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-prose mb-1.5">
            Quote Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => dirty && save()}
            placeholder="e.g. Full Bathroom Renovation"
            className={inputClassName}
          />
          <p className="text-xs text-faint mt-1">
            The main heading shown on the customer&apos;s quote.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-prose mb-1.5">
            Scope of Works
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => dirty && save()}
            rows={6}
            placeholder="Describe what's included in this quote. This appears prominently on the customer's quote."
            className={`${inputClassName} resize-y`}
          />
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-edge">
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
