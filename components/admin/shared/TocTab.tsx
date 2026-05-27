// components/admin/shared/TocTab.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Check, AlertTriangle } from 'lucide-react';
import { supabase, parseTocSettings, TocSettings } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { authFetch } from '@/lib/auth-fetch';
import { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import TocPreview from '@/components/admin/shared/TocPreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import TextInput from '@/components/ui/TextInput';
import Chip from '@/components/ui/Chip';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';

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
  useReportSaveStatus(saveStatus);
  const [settings, setSettings] = useState<TocSettings>(parseTocSettings(null));
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [companyName, setCompanyName] = useState<string | undefined>(undefined);
  const [tocPageId, setTocPageIdState] = useState<string | null>(null);
  const tocPageIdRef = useRef<string | null>(null);
  const setTocPageId = useCallback((id: string | null) => {
    tocPageIdRef.current = id;
    setTocPageIdState(id);
  }, []);
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
        const pagesRes = await authFetch(`${pagesApiBase(entityType)}?${param}=${entityId}`);
        const allPages: Array<{
          id: string;
          type: string;
          title: string;
          indent: number;
          enabled: boolean;
        }> = pagesRes.ok ? await pagesRes.json() : [];

        // 4. Track the toc row ID (needed for delete-on-disable)
        const existingToc = allPages.find((p) => p.type === 'toc');
        setTocPageId(existingToc?.id ?? null);

        // 5. Build tocItems with IDs that match TocPage's excludedSet format:
        //    pdf:N (1-indexed), pricing, packages:{uuid}, text:{uuid}, group:{title}
        let pdfCount = 0;
        const items: TocItem[] = allPages
          .filter((p) => p.enabled && p.type !== 'toc')
          .map((p) => {
            if (p.type === 'pdf') {
              pdfCount++;
              return { id: `pdf:${pdfCount}`, label: p.title || `Page ${pdfCount}`, type: 'pdf' as const, indent: p.indent ?? 0 };
            }
            if (p.type === 'pricing')  return { id: 'pricing',          label: p.title || 'Quote',  type: 'pricing'  as const, indent: p.indent ?? 0 };
            if (p.type === 'packages') return { id: `packages:${p.id}`, label: p.title || 'Packages', type: 'packages' as const, indent: p.indent ?? 0 };
            if (p.type === 'text')     return { id: `text:${p.id}`,     label: p.title || 'Untitled', type: 'text'     as const, indent: p.indent ?? 0 };
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
        const currentTocPageId = tocPageIdRef.current;

        if (newSettings.enabled && !currentTocPageId) {
          const res = await authFetch(apiBase, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              [idKey]: entityId,
              type: 'toc',
              title: newSettings.title || 'Table of Contents',
            }),
          });
          if (res.ok) {
            const newPage = await res.json();
            setTocPageId(newPage.id ?? null);
          }
        } else if (!newSettings.enabled && currentTocPageId) {
          await authFetch(apiBase, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [idKey]: entityId, page_id: currentTocPageId }),
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
  }, [entityId, entityType, setTocPageId, toast]);

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
        className={`flex items-center gap-3 py-2.5 pr-4 ${isChild ? 'pl-8' : 'pl-4'} hover:bg-surface cursor-pointer transition-colors`}
        onClick={() => toggleItem(item.id)}
      >
        {/* Checkbox — all types including section headers */}
        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          isIncluded
            ? isGroup
              ? 'bg-gray-400 border-gray-400'
              : 'bg-teal border-teal'
            : 'border-gray-300'
        }`}>
          {isIncluded && <Check size={10} className="text-white" />}
        </div>

        <span className={`text-sm truncate ${
          isGroup
            ? `font-medium text-xs uppercase tracking-wide ${isIncluded ? 'text-dim' : 'text-gray-300'}`
            : isIncluded ? 'text-prose' : 'text-gray-300'
        }`}>
          {item.label}
        </span>

        {/* Section label badge */}
        {isGroup ? (
          <span className="ml-auto text-2xs px-1.5 py-0.5 rounded-full shrink-0 bg-gray-100 text-faint">
            section
          </span>
        ) : (
          <span className="ml-auto text-2xs px-1.5 py-0.5 rounded-full shrink-0 bg-surface text-muted">
            {item.type}
          </span>
        )}
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header toolbar — no outer card, matches Pages/Quote shell */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <List size={14} className="text-faint" />
          <p className="text-sm font-semibold text-ink">Table of Contents</p>
          <span className="text-xs text-faint hidden sm:inline">
            Auto-generated contents page for this {entityType === 'template' ? 'template' : entityType}
          </span>
        </div>
        <Chip enabled={settings.enabled} onClick={() => updateSettings({ enabled: !settings.enabled })}>
          {settings.enabled ? 'Visible' : 'Hidden'}
        </Chip>
      </div>

      {/* Two-column body */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {settings.enabled ? (
            <div className="space-y-5">
              <TextInput
                id="toc-title"
                label="Page Title"
                value={settings.title}
                onChange={(e) => updateSettings({ title: e.target.value })}
                placeholder="Table of Contents"
              />

              {/* Pages to include */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <label className="text-sm font-medium text-prose">Pages to Include</label>
                    <p className="text-xs text-faint mt-0.5">
                      {includedCount} of {tocItems.length} items selected
                    </p>
                    {includedCount > 16 && (
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-detail text-amber-600 leading-tight">
                          Over 16 items may crowd the PDF. Consider reducing selections.
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={toggleAll}
                    className="text-xs font-medium text-teal hover:text-teal/80 transition-colors shrink-0 ml-4"
                  >
                    {allIncluded ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="border border-edge-strong rounded-lg overflow-hidden">
                  {tocItems.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-faint">No pages found</p>
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
          ) : (
            <div className="rounded-lg border border-dashed border-edge-strong bg-surface py-12 text-center">
              <List size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-faint mb-1">Table of Contents is currently disabled</p>
              <p className="text-xs text-gray-300">Toggle the switch above to add a contents page</p>
            </div>
          )}
        </div>

        {settings.enabled && (
          <StickyPreviewAside>
            <TocPreview
              tocSettings={settings}
              branding={branding}
              tocItems={tocItems}
              companyName={companyName}
            />
          </StickyPreviewAside>
        )}
      </div>
    </div>
  );
}