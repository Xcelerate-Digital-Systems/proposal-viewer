// components/admin/ads/AudienceTab.tsx
//
// Per-client personas list. Replaces the old TargetMarketsTab which managed
// two overlapping concepts (target markets + personas). We consolidated on
// "persona" as the single audience taxonomy — broad market descriptions like
// "Tradies", "Homeowners", "E-com owners" are now just personas.
//
// Personas are stored as a string array on ad_trackers.standards.personas.
'use client';

import { useEffect, useState, KeyboardEvent } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import type { TrackerStandards } from '@/lib/types/ads';

type Props = {
  trackerStandards?: TrackerStandards;
  onSaveTrackerStandards?: (standards: TrackerStandards) => Promise<void>;
};

export default function AudienceTab({ trackerStandards, onSaveTrackerStandards }: Props) {
  const [personas, setPersonas] = useState<string[]>(trackerStandards?.personas || []);
  const [personaInput, setPersonaInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPersonas(trackerStandards?.personas || []);
  }, [trackerStandards]);

  const persistPersonas = async (next: string[]) => {
    setPersonas(next);
    if (!onSaveTrackerStandards || !trackerStandards) return;
    setSaving(true);
    await onSaveTrackerStandards({ ...trackerStandards, personas: next });
    setSaving(false);
  };

  const addPersona = () => {
    const value = personaInput.trim();
    if (!value) {
      setPersonaInput('');
      return;
    }
    // Case-insensitive dedup so "Tradies" and "tradies" don't both land.
    const lower = value.toLowerCase();
    if (personas.some((p) => p.toLowerCase() === lower)) {
      setPersonaInput('');
      return;
    }
    persistPersonas([...personas, value]);
    setPersonaInput('');
  };

  const removePersona = (name: string) => {
    persistPersonas(personas.filter((p) => p !== name));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPersona();
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-base font-semibold text-ink mb-1">Audience</h2>
      <p className="text-[12px] text-faint mb-5">
        The personas this client&apos;s ads speak to. Keep it broad — e.g. <span className="font-medium text-ink">Tradies</span>, <span className="font-medium text-ink">Homeowners</span>, <span className="font-medium text-ink">E-com owners</span>. Powers the persona dropdown on each ad creative.
      </p>

      <h3 className="text-[13px] font-semibold text-ink mb-2 flex items-center gap-1.5">
        Personas {saving && <Loader2 size={12} className="animate-spin text-teal" />}
      </h3>

      {personas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {personas.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-teal/10 text-teal rounded-full text-[12px] font-medium"
            >
              {p}
              <button
                type="button"
                onClick={() => removePersona(p)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-teal/20"
                aria-label={`Remove ${p}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={personaInput}
          onChange={(e) => setPersonaInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Add a persona (e.g. Tradies, Homeowners)"
          className="flex-1 px-3 py-2 bg-surface border border-gray-100 rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 /30"
        />
        <button
          type="button"
          onClick={addPersona}
          disabled={!personaInput.trim()}
          className="flex items-center gap-1 px-3 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}
