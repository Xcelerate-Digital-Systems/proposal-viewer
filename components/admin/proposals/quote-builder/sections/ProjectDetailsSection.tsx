// components/admin/proposals/quote-builder/sections/ProjectDetailsSection.tsx
'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface ProjectDetailsSectionProps {
  proposal: Proposal;
  onSaved: () => void;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function ProjectDetailsSection({
  proposal,
  onSaved,
}: ProjectDetailsSectionProps) {
  const toast = useToast();
  const [title, setTitle] = useState(proposal.title ?? '');
  const [description, setDescription] = useState(proposal.description ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  const generateScope = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ kind: 'scope', projectTitle: title }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setDescription(json.text || '');
      toast.success('Scope generated — review and save');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate scope');
    } finally {
      setGenerating(false);
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
            placeholder="e.g. Full Bathroom Renovation"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
          />
          <p className="text-xs text-gray-400 mt-1">
            The main heading shown on the customer&apos;s quote.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Scope of Works
            </label>
            <button
              type="button"
              onClick={generateScope}
              disabled={generating}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              Generate with AI
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => dirty && save()}
            rows={6}
            placeholder="Describe what's included in this quote. This appears prominently on the customer's quote."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-y"
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
