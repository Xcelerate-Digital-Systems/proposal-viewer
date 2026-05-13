// components/admin/proposals/quote-builder/sections/BackgroundsSection.tsx
// Quick colour controls for the three background layers a quote has:
//   - Page (the area surrounding the floating quote card)
//   - Body (the document interior — sections + footer)
//   - Cover header is on its own Cover tab; we surface a link.
//
// Power users can still go to the Cover / Design tabs for finer control —
// this section is the "quick swap" that covers ~80% of customisation.

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, RotateCcw, Palette } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '../SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

const DEFAULT_PAGE_BG = '#eeece6';
const DEFAULT_BODY_BG = '#ffffff';

function ColorField({
  label,
  hint,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw size={9} />
            Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 rounded border border-gray-200 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultValue}
          className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-teal/30"
        />
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function BackgroundsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const [pageBg, setPageBg] = useState(proposal.quote_page_bg_color || DEFAULT_PAGE_BG);
  const [bodyBg, setBodyBg] = useState(proposal.text_page_bg_color || DEFAULT_BODY_BG);
  const [saving, setSaving] = useState(false);

  const dirty =
    pageBg !== (proposal.quote_page_bg_color || DEFAULT_PAGE_BG) ||
    bodyBg !== (proposal.text_page_bg_color || DEFAULT_BODY_BG);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({
        quote_page_bg_color: pageBg === DEFAULT_PAGE_BG ? null : pageBg,
        text_page_bg_color: bodyBg === DEFAULT_BODY_BG ? null : bodyBg,
      })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save');
    else {
      toast.success('Backgrounds saved');
      onSaved();
    }
  };

  return (
    <SectionCard
      title="Backgrounds"
      icon={<Palette size={14} className="text-gray-400" />}
      description="Quick colour swaps for the page surround and quote body. Cover header lives on the Cover tab."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ColorField
          label="Page background"
          hint="The area around the quote card — gives the document contrast."
          value={pageBg}
          defaultValue={DEFAULT_PAGE_BG}
          onChange={setPageBg}
        />
        <ColorField
          label="Quote body background"
          hint="The document interior. Defaults to white."
          value={bodyBg}
          defaultValue={DEFAULT_BODY_BG}
          onChange={setBodyBg}
        />
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <Link
          href={`/quotes/${proposal.id}/cover`}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Edit cover header →
        </Link>
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
