// components/admin/proposals/DecisionPageCard.tsx
// Shared control card for the synthetic Decision page. Mirrored in three
// tabs (Pages, Contents, Details) so the user can rename + toggle the page
// from whichever surface they happen to be on. All three callers point at
// the same two columns (proposals.decision_page_enabled +
// proposals.decision_page_title) so edits stay in sync.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import { inputClassName } from '@/components/ui/FormField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

interface DecisionPageCardProps {
  entityId: string;
  /** Defaults to 'proposals'. Templates write to 'proposal_templates'. */
  table?: 'proposals' | 'proposal_templates';
  /** NULL = treat as true (default on). */
  initialEnabled: boolean | null;
  /** NULL = default "Decision". */
  initialTitle: string | null;
  /** Notify parent after a successful save so it can refetch if needed. */
  onSaved?: () => void;
  /** When true, only renders the title input — used on the Pages tab where
   *  the page list already manages presence and the master toggle lives on
   *  the Decision tab. Hides the enable switch + descriptive copy. */
  titleOnly?: boolean;
  /** Fires on every keystroke so a parent preview can show the live value
   *  without waiting for the debounced save. Optional. */
  onTitleLive?: (next: string) => void;
}

export default function DecisionPageCard({
  entityId,
  table = 'proposals',
  initialEnabled,
  initialTitle,
  onSaved,
  titleOnly,
  onTitleLive,
}: DecisionPageCardProps) {
  const toast = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // null → treat as on; explicit false → off.
  const [enabled, setEnabled] = useState<boolean>(initialEnabled !== false);
  const [title, setTitle] = useState<string>(initialTitle ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);

  const save = useCallback(
    async (nextEnabled: boolean, nextTitle: string) => {
      setSaveStatus('saving');
      try {
        const { error } = await supabase
          .from(table)
          .update({
            decision_page_enabled: nextEnabled,
            decision_page_title: nextTitle.trim() ? nextTitle.trim() : null,
          })
          .eq('id', entityId);
        if (error) throw error;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        onSaved?.();
      } catch {
        setSaveStatus('idle');
        toast.error('Failed to save Decision page settings');
      }
    },
    [entityId, table, toast, onSaved],
  );

  const scheduleSave = useCallback(
    (nextEnabled: boolean, nextTitle: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(nextEnabled, nextTitle), 600);
    },
    [save],
  );

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    // Toggle saves immediately — no point waiting for a debounce on a binary.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(next, title);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    onTitleLive?.(val);
    scheduleSave(enabled, val);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <SectionCard
      title="Decision Page"
      description={titleOnly
        ? 'Rename the final accept/decline page. Toggle on/off + Next Steps + Terms live on the Decision tab.'
        : 'The final page where clients accept, decline, or request changes. Synthetic — lives only in the viewer, not as a real page row.'}
      icon={<CheckCircle2 size={14} className="text-gray-400" />}
    >
      <div className="space-y-4">
        {/* Enabled toggle — hidden on the Pages tab variant. */}
        {!titleOnly && (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">Show on this proposal</p>
              <p className="text-[11px] text-gray-400 leading-snug">
                Off removes the page from the sequence — clients won&apos;t have an in-viewer accept/decline path.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                enabled ? 'bg-teal' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        {/* Title input */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Decision"
            disabled={!titleOnly && !enabled}
            className={`${inputClassName} ${(!titleOnly && !enabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <p className="text-[10px] text-gray-400">
            Shown in the sidebar TOC + on the page itself. Leave blank to use &ldquo;Decision&rdquo;.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
