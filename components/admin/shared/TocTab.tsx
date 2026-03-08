// components/admin/shared/TocTab.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react';
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

function groupByIndent(items: TocItem[]): ItemGroup[] {
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

/* ─── TypeBadge ─────────────────────────────────────────────────────── */

function TypeBadge({ type }: { type: TocItem['type'] }) {
  if (type === 'group') return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">Section</span>
  );
  if (type === 'pricing') return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">Pricing</span>
  );
  if (type === 'packages') return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">Packages</span>
  );
  if (type === 'text') return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">Text</span>
  );
  return null;
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
  const [tocPageId, setTocPageId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const table = entityTable(entityType);

        const { data: entity } = await supabase
          .from(table)
          .select('id, company_id, toc_settings')
          .eq('id', entityId)
          .single();

        if (!entity) return;

        setSettings(parseTocSettings(entity.toc_settings));

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

        const param = entityIdParam(entityType);
        const pagesRes = await fetch(`/api/${entityType}s/pages?${param}=${entityId}`);
        const allPages: Array<{
          id: string;
          type: string;
          title: string;
          indent: number;
          enabled: boolean;
        }> = pagesRes.ok ? await pagesRes.json() : [];

        // Track the existing toc page row id so we can delete it on toggle-off
        const existingToc = allPages.find((p) => p.type === 'toc');
        setTocPageId(existingToc?.id ?? null);

        const items: TocItem[] = allPages
          .filter((p) => p.enabled)
          .map((p) => ({
            id: p.id,
            label: p.title || 'Untitled',
            type: p.type === 'section' ? 'group' : (p.type as TocItem['type']),
            indent: p.indent ?? 0,
          }));

        setTocItems(items);
      } catch (err) {
        console.error('TocTab fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [entityId, entityType]);

  const save = useCallback(async (newSettings: TocSettings, prevEnabled?: boolean) => {
    setSaveStatus('saving');
    try {
      const table = entityTable(entityType);
      const { error } = await supabase.from(table).update({ toc_settings: newSettings }).eq('id', entityId);
      if (error) throw error;

      // Sync the _v2 toc page row when enabled state changes
      if (prevEnabled !== undefined && prevEnabled !== newSettings.enabled) {
        const apiBase = pagesApiBase(entityType);
        const idKey = entityIdParam(entityType);

        if (newSettings.enabled) {
          // Create the toc row at position 0
          const res = await fetch(apiBase, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              [idKey]: entityId,
              type: 'toc',
              title: newSettings.title || 'Table of Contents',
              position: 0,
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
    debounceRef.current = setTimeout(() => { save(newSettings, prevEnabled); debounceRef.current = null; }, 800);
  }, [save]);

  const updateSettings = useCallback((changes: Partial<TocSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      const prevEnabled = 'enabled' in changes ? prev.enabled : undefined;
      scheduleSave(next, prevEnabled);
      return next;
    });
  }, [scheduleSave]);

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
      const next = { ...prev, excluded_items: allExcluded ? [] : tocItems.map((item) => item.id) };
      scheduleSave(next);
      return next;
    });
  }, [tocItems, scheduleSave]);

  const excludedSet = useMemo(() => new Set(settings.excluded_items), [settings.excluded_items]);
  const includedCount = tocItems.filter((item) => !excludedSet.has(item.id)).length;
  const allIncluded = tocItems.length > 0 && includedCount === tocItems.length;
  const itemGroups = useMemo(() => groupByIndent(tocItems), [tocItems]);

  const renderRow = (item: TocItem, isChild = false) => {
    const isIncluded = !excludedSet.has(item.id);
    const isGroup = item.type === 'group';
    return (
      <button
        key={item.id}
        onClick={() => toggleItem(item.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
          isChild ? 'pl-4' : ''
        } ${isIncluded ? '' : 'opacity-40'} ${isGroup ? 'bg-gray-50/60' : ''}`}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          isIncluded ? 'bg-[#017C87] border-[#017C87]' : 'border-gray-300 bg-white'
        }`}>
          {isIncluded && <Check size={10} className="text-white" />}
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TypeBadge type={item.type} />
          <span className={`text-sm truncate ${isGroup ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>
            {item.label}
          </span>
        </div>
        {isIncluded
          ? <Eye size={13} className="text-gray-300 shrink-0" />
          : <EyeOff size={13} className="text-gray-300 shrink-0" />
        }
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#017C87]/10 flex items-center justify-center">
            <List size={16} className="text-[#017C87]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Table of Contents</h2>
            <p className="text-xs text-gray-400">
              Add an auto-generated contents page to your {entityType === 'template' ? 'template' : entityType}
            </p>
          </div>
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
          <div className="space-y-5">
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
                          <div className="mx-3 mb-1" style={{ borderLeft: '2px solid #017C8730' }}>
                            {group.children.map((child: TocItem) => renderRow(child, true))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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