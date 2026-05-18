// components/admin/builder-sections/PackagesDesignPanel.tsx
// Entity-level packages styling editor. Reads / writes
// proposals.package_styling (or proposal_templates.package_styling) directly.
// Per-page styling is no longer edited — the viewer falls back to per-page
// only for rows that haven't been migrated.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Palette } from 'lucide-react';
import {
  supabase, normalizePackageStyling, DEFAULT_PACKAGE_STYLING,
  type PackageStyling, type PackageTier,
} from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import PackagesAppearanceSection from '@/components/admin/shared/PackagesAppearanceSection';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import type { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

interface Props {
  entityId: string;
  entityKey: 'proposal_id' | 'template_id';
  onSave?: () => void;
}

export default function PackagesDesignPanel({ entityId, entityKey, onSave }: Props) {
  const toast = useToast();
  const table = entityKey === 'template_id' ? 'proposal_templates' : 'proposals';

  const [loaded, setLoaded] = useState(false);
  const [styling, setStyling] = useState<PackageStyling>(DEFAULT_PACKAGE_STYLING);
  // Tier list — loaded read-only from the first packages page so the
  // per-tier styling overrides (card_bg_color / card_text_color /
  // highlight_color) can still be edited from here. Tier content stays on
  // the Packages tab; only the styling overrides are written by this panel.
  const [tiers, setTiers] = useState<PackageTier[]>([]);
  const [packagesPageId, setPackagesPageId] = useState<string | null>(null);
  const [packagesPageTitle, setPackagesPageTitle] = useState('Your Investment');
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load entity styling + first packages page tiers ────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: entity } = await supabase
        .from(table)
        .select('package_styling')
        .eq('id', entityId)
        .single();
      if (cancelled) return;
      if (entity?.package_styling) {
        setStyling(normalizePackageStyling(entity.package_styling));
      }

      const apiBase = entityKey === 'template_id' ? '/api/templates/pages' : '/api/proposals/pages';
      const res = await fetch(`${apiBase}?${entityKey}=${entityId}`);
      if (!res.ok) { setLoaded(true); return; }
      const pages = await res.json() as Array<{
        id: string; type: string; position: number; payload: Record<string, unknown>;
      }>;
      const firstPackages = pages
        .filter((p) => p.type === 'packages')
        .sort((a, b) => a.position - b.position)[0];
      if (firstPackages) {
        setPackagesPageId(firstPackages.id);
        setTiers(((firstPackages.payload as Record<string, unknown>)?.packages as PackageTier[]) || []);
        const t = (firstPackages as { title?: string }).title;
        if (t) setPackagesPageTitle(t);
      }

      // Branding for the preview
      const entityIdForBranding = entityId;
      const tableForCompany = entityKey === 'template_id' ? 'proposal_templates' : 'proposals';
      const { data: ent } = await supabase
        .from(tableForCompany)
        .select('company_id')
        .eq('id', entityIdForBranding)
        .single();
      const cid = (ent?.company_id as string | undefined) ?? null;
      if (cid) {
        const r = await fetch(`/api/company/branding?company_id=${cid}`);
        if (r.ok && !cancelled) {
          setBranding({ ...DEFAULT_BRANDING, ...(await r.json()) });
        }
      }

      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [entityId, entityKey, table]);

  /* ── Save styling to entity ─────────────────────────────────── */
  const persistStyling = useCallback(async (next: PackageStyling) => {
    setSaveStatus('saving');
    const { error } = await supabase
      .from(table)
      .update({ package_styling: next })
      .eq('id', entityId);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    if (error) toast.error('Failed to save packages design');
    else onSave?.();
  }, [entityId, table, onSave, toast]);

  const onStylingChange = (next: PackageStyling) => {
    setStyling(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistStyling(next), 800);
  };

  /* ── Per-tier styling overrides save (write to packages page) ── */
  const persistTier = useCallback(async (nextTiers: PackageTier[]) => {
    if (!packagesPageId) return;
    setSaveStatus('saving');
    const apiBase = entityKey === 'template_id' ? '/api/templates/pages' : '/api/proposals/pages';
    const res = await fetch(`${apiBase}?id=${packagesPageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload_patch: { packages: nextTiers } }),
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    if (!res.ok) toast.error('Failed to save tier overrides');
    else onSave?.();
  }, [packagesPageId, entityKey, onSave, toast]);

  const onTierChange = (tierId: string, changes: Partial<PackageTier>) => {
    const next = tiers.map((t) => (t.id === tierId ? { ...t, ...changes } : t));
    setTiers(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistTier(next), 800);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  /* ── Render ─────────────────────────────────────────────────── */
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // Synthesised ProposalPackages object so we can hand it to PackagesPreview.
  // Live-reflects the styling + tier overrides the user is currently editing.
  const previewPackages = {
    id: packagesPageId ?? 'preview',
    proposal_id: entityId,
    company_id: '',
    enabled: true,
    position: 0,
    sort_order: 0,
    indent: 0,
    title: packagesPageTitle,
    intro_text: null,
    packages: tiers,
    footer_text: null,
    styling,
    created_at: '',
    updated_at: '',
  };

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
        <SectionCard
          title="Packages Design"
          description="Colours, gradients, feature icons, and per-tier overrides — applies to every packages page."
          icon={<Palette size={14} className="text-gray-400" />}
        >
          <PackagesAppearanceSection
            styling={styling}
            tiers={tiers}
            onStylingChange={onStylingChange}
            onTierChange={onTierChange}
          />
        </SectionCard>
      </div>

      <aside className="hidden xl:block w-[420px] 2xl:w-[480px] shrink-0">
        <div className="sticky top-6">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <PackagesPreview packages={previewPackages as any} branding={branding} />
        </div>
      </aside>
    </div>
  );
}
