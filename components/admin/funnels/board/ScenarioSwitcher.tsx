'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, GitBranch, Plus, Loader2, Check } from 'lucide-react';
import { supabase, type Funnel } from '@/lib/supabase';
import { duplicateFunnelAsScenario } from '@/lib/funnel/duplicate-funnel';
import { useToast } from '@/components/ui/Toast';

interface Props {
  funnel: Funnel;
  companyId: string;
  userId: string | null;
}

/**
 * Scenario family switcher rendered in the editor toolbar. Lists every
 * funnel that shares this funnel's root (the parent or itself) so the user
 * can hop between what-if variations without going back to the index, and
 * spin up new scenarios in one click.
 */
export default function ScenarioSwitcher({ funnel, companyId, userId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<Funnel[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [creating, setCreating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // The "root" funnel id — if this is a scenario it's the parent, otherwise
  // it's this funnel itself. The family = root + everything whose parent
  // points at root.
  const rootId = funnel.parent_funnel_id ?? funnel.id;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingFamily(true);
      // Pull the root + every funnel that points to it. One query: where id=root OR parent_funnel_id=root.
      const { data } = await supabase
        .from('funnels')
        .select('*')
        .or(`id.eq.${rootId},parent_funnel_id.eq.${rootId}`)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setFamily((data || []) as Funnel[]);
        setLoadingFamily(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, rootId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSwitch = (id: string) => {
    if (id === funnel.id) { setOpen(false); return; }
    router.push(`/funnels/${id}/board`);
  };

  const handleNewScenario = async () => {
    setCreating(true);
    const created = await duplicateFunnelAsScenario({ source: funnel, companyId, userId });
    setCreating(false);
    if (!created) {
      toast.error('Failed to create scenario');
      return;
    }
    toast.success('Scenario created');
    router.push(`/funnels/${created.id}/board`);
  };

  const scenarioCount = family.filter((f) => f.id !== rootId).length;
  const isScenario = !!funnel.parent_funnel_id;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-ink px-2.5 py-1 rounded-full hover:bg-surface transition-colors"
        title="Scenarios"
      >
        <GitBranch size={12} />
        <span>{isScenario ? 'Scenario' : 'Base'}</span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-[280px] bg-white border border-edge rounded-lg shadow-xl z-30 overflow-hidden">
          <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted">
              {family.length > 0 ? `${family.length} scenarios` : 'Scenarios'}
            </span>
            {loadingFamily && <Loader2 size={11} className="animate-spin text-muted" />}
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            {family.length === 0 && !loadingFamily && (
              <div className="px-3 py-4 text-detail text-muted text-center">
                No scenarios yet
              </div>
            )}
            {family.map((f) => {
              const isCurrent = f.id === funnel.id;
              const isRoot = f.id === rootId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSwitch(f.id)}
                  className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                    isCurrent ? 'bg-teal/10' : 'hover:bg-surface'
                  }`}
                >
                  <div className="w-4 mt-0.5 flex-shrink-0">
                    {isCurrent && <Check size={12} className="text-teal" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs truncate ${isCurrent ? 'font-semibold text-ink' : 'text-ink/80'}`}>
                      {f.name}
                    </div>
                    <div className="text-2xs text-muted mt-0.5">
                      {isRoot ? 'Base funnel' : 'Scenario'}
                      {f.id === funnel.id && ' · viewing'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-edge p-2">
            <button
              type="button"
              onClick={handleNewScenario}
              disabled={creating}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-teal hover:bg-teal/10 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              New scenario from this
            </button>
            <p className="text-2xs text-muted mt-1.5 px-1 leading-snug">
              Clones the current funnel — change metrics to compare against {scenarioCount > 0 ? 'siblings' : 'the base'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
