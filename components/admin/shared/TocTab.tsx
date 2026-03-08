// components/admin/shared/TocTab.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Check, AlertTriangle } from 'lucide-react';
import { supabase, parseTocSettings, TocSettings } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import TocPreview from '@/components/admin/shared/TocPreview';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TocTabProps {
  entityId: string;
  entityType: 'proposal' | 'template' | 'document';
}

type TocItem = {
  id: string;
  label: string;
  type: 'pdf' | 'text' | 'pricing' | 'packages' | 'group';
  indent: number;
};

type ItemGroup = { parent: TocItem; children: TocItem[] };

type SaveStatus = 'idle' | 'saving' | 'saved';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const entityTable = (type: 'proposal' | 'template' | 'document') => {
  if (type === 'proposal') return 'proposals';
  if (type === 'template') return 'proposal_templates';
  return 'documents';
};

const entityIdParam = (type: 'proposal' | 'template' | 'document') => {
  if (type === 'proposal') return 'proposal_id';
  if (type === 'template') return 'template_id';
  return 'document_id';
};

const pagesApiBase = (type: 'proposal' | 'template' | 'document') => {
  if (type === 'proposal') return '/api/proposals/pages';
  if (type === 'template') return '/api/templates/pages';
  return '/api/documents/pages';
};

/**
 * Group flat TocItems into parent+children structure.
 * Any item with indent > 0 attaches as a child of the nearest preceding indent=0 item.
 */
function groupItems(items: TocItem[]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  for (const item of items) {
    if (item.indent === 0) {
      groups.push({ parent: item, children: [] });
    } else {
      if (groups.length === 0) {
        // Edge case: indented item with no preceding parent — treat as top-level
        groups.push({ parent: item, children: [] });
      } else {
        groups[groups.length - 1].children.push(item);
      }
    }
  }
  return groups;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function TocTab({ entityId, entityType }: TocTabProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [settings, setSettings] = useState<TocSettings>(parseTocSettings(null));
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [companyName, setCompanyName] = useState<string | undefined>(undefined);
  /** ID of the toc row in _v2 table (null if no row exists) */
  const [tocPageId, setTocPageId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load data ───────────────────────────────────────────────── */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const table = entityTable(entityType);

        // 1. Load entity for toc_settings + company_id
        const { data: entity } = await supabase
          .from(table)
          .select('id, company_id, toc_settings')
          .eq('id', entityId)
          .single();

        if (!entity) return;

        const parsedSettings = parseTocSettings(entity.toc_settings);
        setSettings(parsedSettings);

        // 2. Load branding
        if (entity.company_id) {
          try {
            const res = await fetch(`/api/company/branding?company_id=${entity.company_id}`);
            if (res.ok) {
              const data = await res.json();
              setBranding({ ...DEFAULT_BRANDING, ...data });
              setCompanyName(data.name || undefined);
            }
          } catch { /* use defaults */ }
        }

        // 3. Load all pages from v2 API
        const param = entityIdParam(entityType);
        const pagesRes = await fetch(`${pagesApiBase(entityType)}?${param}=${entityId}`);
        const allPages: Array<{
          id: string;
          type: string;
          title: string;
          indent: number;
          enabled: boolean;
        }> = pagesRes.ok ? await pagesRes.json() : [];

        // 4. Track the toc row ID (needed for delete-on-disable)
        const existingToc = allPages.find((p) => p.type === 'toc');
        const resolvedTocId = existingToc?.id ?? null;
        setTocPageId(resolvedTocId);

        // 5. Auto-heal: if settings say enabled but no _v2 toc row exists, create it
        if (parsedSettings.enabled && !resolvedTocId) {
          try {
            const apiBase = pagesApiBase(entityType);
            const idKey = entityIdParam(entityType);
            const healRes = await fetch(apiBase, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                [idKey]: entityId,
                type: 'toc',
                title: parsedSettings.title || 'Table of Contents',
                position: -1, // append at end
              }),
            });
            if (healRes.ok) {
              const newPage = await healRes.json();
              setTocPageId(newPage.id ?? null);
            }
          } catch {
            // Non-critical — user can toggle off/on to retry
          }
        }

        // 6. Build tocItems with IDs that match TocPage's excludedSet format:
        //    pdf:N (1-indexed virtual pdf count), pricing, packages:{uuid}, text:{uuid}, group:{title}
        let pdfCount = 0;
        const items: TocItem[] = allPages
          .filter((p) => p.enabled && p.type !== 'toc')
          .map((p) => {
            if (p.type === 'pdf') {
              pdfCount++;
              return { id: `pdf:${pdfCount}`, label: p.title || `Page ${pdfCount}`, type: 'pdf' as const, indent: p.indent ?? 0 };
            }
            if (p.type === 'pricing')  return { id: 'pricing',           label: p.title || 'Pricing',   type: 'pricing'  as const, indent: p.indent ?? 0 };
            if (p.type === 'packages') return { id: `packages:${p.id}`,  label: p.title || 'Packages',  type: 'packages' as const, indent: p.indent ?? 0 };
            if (p.type === 'text')     return { id: `text:${p.id}`,      label: p.title || 'Untitled',  type: 'text'     as const, indent: p.indent ?? 0 };
            // section → group
            return { id: `group:${p.title}`, label: p.title || 'Section', type: 'group' as const, indent: p.indent ?? 0 };
          });

        setTocItems(items);
      } catch (err) {
        console.error('TocTab fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [entityId, entityType]);

  /* ── Save ───────────────────────────────────────────────────── */

  const save = useCallback(async (newSettings: TocSettings, prevEnabled?: boolean) => {
    setSaveStatus('saving');
    try {
      // Save toc_settings on the entity row
      const table = entityTable(entityType);
      const { error } = await supabase
        .from(table)
        .update({ toc_settings: newSettings })
        .eq('id', entityId);
      if (error) throw error;

      // Sync the _v2 toc page row when enabled state changes
      if (prevEnabled !== undefined && prevEnabled !== newSettings.enabled) {
        const apiBase = pagesApiBase(entityType);
        const idKey = entityIdParam(entityType);

        if (newSettings.enabled) {
          // Create the toc row (append at end so it doesn't clobber existing positions)
          const res = await fetch(apiBase, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              [idKey]: entityId,
              type:     'toc',
              title:    newSettings.title || 'Table of Contents',
              position: -1,
            }),
          });
          if (res.ok) {
            const newPage = await res.json();
            setTocPageId(newPage.id ?? null);
          }
        } else if (tocPageId) {
          // Delete the toc row
          await fetch(apiBase, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [idKey]: entityId, page_id: tocPageId }),
          });
          setTocPageId(null);
        }
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save table of contents settings');
      setSaveStatus('idle');
    }
  }, [entityId, entityType, tocPageId, toast]);

  const scheduleSave = useCallback((newSettings: TocSettings, prevEnabled?: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(newSettings, prevEnabled);
      debounceRef.current = null;
    }, 800);
  }, [save]);

  const updateSettings = useCallback((changes: Partial<TocSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      // Pass the previous enabled value so save() knows whether to create/delete _v2 row
      const prevEnabled = 'enabled' in changes ? prev.enabled : undefined;
      scheduleSave(next, prevEnabled);
      return next;
    });
  }, [scheduleSave]);

  /* ── Item toggles ───────────────────────────────────────────── */

  const toggleItem = useCallback((itemId: string) => {
    setSettings((prev) => {
      const excluded = new Set(prev.excluded_items);
      if (excluded.has(itemId)) { excluded.delete(itemId); } else { excluded.add(itemId); }
      const next = { ...prev, excluded_items: Array.from(excluded) };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const toggleAll = useCallback(() => {
    setSettings((prev) => {
      const allExcluded = tocItems.every((item) => prev.excluded_items.includes(item.id));
      const next = {
        ...prev,
        excluded_items: allExcluded ? [] : tocItems.map((i) => i.id),
      };
      scheduleSave(next);
      return next;
    });
  }, [tocItems, scheduleSave]);

  /* ── Derived ────────────────────────────────────────────────── */

  const itemGroups: ItemGroup[] = useMemo(() => groupItems(tocItems), [tocItems]);

  const includedCount = tocItems.filter((i) => !settings.excluded_items.includes(i.id)).length;
  const allIncluded   = tocItems.every((i) => !settings.excluded_items.includes(i.id));

  /* ── Row renderer ───────────────────────────────────────────── */

  const renderRow = (item: TocItem, isChild = false) => {
    const isIncluded = !settings.excluded_items.includes(item.id);
    const isGroup    = item.type === 'group';

    return (
      <div
        key={item.id}
        className={`flex items-center gap-3 py-2.5 pr-4 ${isChild ? 'pl-8' : 'pl-4'} ${
          isGroup ? 'bg-gray-50' : 'hover:bg-gray-50'
        } cursor-pointer transition-colors`}
        onClick={() => !isGroup && toggleItem(item.id)}
      >
        {!isGroup && (
          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
            isIncluded ? 'bg-[#017C87] border-[#017C87]' : 'border-gray-300'
          }`}>
            {isIncluded && <Check size={10} className="text-white" />}
          </div>
        )}
        <span className={`text-sm truncate ${
          isGroup ? 'font-medium text-gray-500 text-xs uppercase tracking-wide' : 'text-gray-700'
        }`}>
          {item.label}
        </span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
          item.type === 'pdf'      ? 'bg-gray-100 text-gray-400'      :
          item.type === 'text'     ? 'bg-blue-50 text-blue-400'       :
          item.type === 'pricing'  ? 'bg-green-50 text-green-500'     :
          item.type === 'packages' ? 'bg-purple-50 text-purple-500'   :
          'hidden'
        }`}>
          {item.type !== 'group' ? item.type : ''}
        </span>
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <List size={15} className="text-[#017C87]" />
            Table of Contents
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Auto-generated contents page for this{' '}
            {entityType === 'template' ? 'template' : entityType}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={() => updateSettings({ enabled: !settings.enabled })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              settings.enabled ? 'bg-[#017C87]' : 'bg-gray-200'
            }`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              settings.enabled ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {settings.enabled ? (
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-6 items-start">

          {/* ── Left: controls ── */}
          <div className="space-y-5">

            {/* Page title */}
            <div>
              <label htmlFor="toc-title" className="block text-sm font-medium text-gray-700 mb-1">
                Page Title
              </label>
              <input
                id="toc-title"
                type="text"
                value={settings.title}
                onChange={(e) => updateSettings({ title: e.target.value })}
                placeholder="Table of Contents"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
              />
            </div>

            {/* Pages to include */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <label className="text-sm font-medium text-gray-700">Pages to Include</label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {includedCount} of {tocItems.length} pages selected
                  </p>
                  {includedCount > 16 && (
                    <div className="flex items-start gap-1.5 mt-1.5">
                      <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-600 leading-tight">
                        Over 16 items may crowd the PDF. Consider reducing selections.
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={toggleAll}
                  className="text-xs font-medium text-[#017C87] hover:text-[#017C87]/80 transition-colors shrink-0 ml-4"
                >
                  {allIncluded ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {tocItems.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">No pages found</p>
                    <p className="text-xs text-gray-300 mt-1">Add PDF pages, text pages, or pricing to see them here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {itemGroups.map((group, gi) => (
                      <div key={`group-${gi}`}>
                        {renderRow(group.parent)}
                        {group.children.length > 0 && (
                          <div
                            className="mx-3 mb-1"
                            style={{ borderLeft: '2px solid #017C8730' }}
                          >
                            {group.children.map((child) => renderRow(child, true))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <TocPreview
            tocSettings={settings}
            branding={branding}
            tocItems={tocItems}
            companyName={companyName}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <List size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400 mb-1">Table of Contents is currently disabled</p>
          <p className="text-xs text-gray-300">Toggle the switch above to add a contents page</p>
        </div>
      )}
    </div>
  );
}