// components/admin/shared/TocTab.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Check, Eye, EyeOff, GripVertical } from 'lucide-react';
import { supabase, parseTocSettings, TocSettings, PageNameEntry, normalizePageNamesWithGroups } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TocTabProps {
  entityId: string;
  entityType: 'proposal' | 'template' | 'document';
}

type TocItem = {
  id: string;           // e.g. "pdf:1", "text:uuid", "pricing", "packages", "group:SectionName"
  label: string;        // Display name
  type: 'pdf' | 'text' | 'pricing' | 'packages' | 'group';
  indent: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const tableName = (type: 'proposal' | 'template' | 'document') => {
  if (type === 'proposal') return 'proposals';
  if (type === 'template') return 'proposal_templates';
  return 'documents';
};

/* ─── Component ──────────────────────────────────────────────────────── */

export default function TocTab({ entityId, entityType }: TocTabProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [settings, setSettings] = useState<TocSettings>(parseTocSettings(null));
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch entity + build item list ──────────────────────────── */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const table = tableName(entityType);

        // 1. Fetch the entity for toc_settings + page_names
        const { data: entity } = await supabase
          .from(table)
          .select('*')
          .eq('id', entityId)
          .single();

        if (!entity) return;

        // Parse existing settings
        setSettings(parseTocSettings(entity.toc_settings));

        // 2. Build the list of TOC-able items
        const items: TocItem[] = [];

        // PDF pages + groups from page_names
        if (entityType === 'template') {
          // Templates use template_pages as source of truth
          const { data: tPages } = await supabase
            .from('template_pages')
            .select('page_number, label, indent')
            .eq('template_id', entityId)
            .order('page_number', { ascending: true });

          const pdfCount = tPages?.length || 0;

          // Re-insert groups from page_names
          const normalized = normalizePageNamesWithGroups(entity.page_names, pdfCount);
          let pdfIdx = 0;
          for (const entry of normalized) {
            if (entry.type === 'group') {
              items.push({
                id: `group:${entry.name}`,
                label: entry.name,
                type: 'group',
                indent: entry.indent,
              });
            } else {
              pdfIdx++;
              const tPage = tPages?.find((p: { page_number: number }) => p.page_number === pdfIdx);
              items.push({
                id: `pdf:${pdfIdx}`,
                label: tPage?.label || entry.name || `Page ${pdfIdx}`,
                type: 'pdf',
                indent: entry.indent,
              });
            }
          }
        } else {
          // Proposals + documents: use page_names directly
          // We need PDF page count — for proposals/documents it's stored indirectly
          const pageNames = entity.page_names;
          if (Array.isArray(pageNames)) {
            let pdfIdx = 0;
            for (const item of pageNames) {
              const entry: PageNameEntry = typeof item === 'string'
                ? { name: item, indent: 0 }
                : item as PageNameEntry;

              if (entry.type === 'group') {
                items.push({
                  id: `group:${entry.name}`,
                  label: entry.name,
                  type: 'group',
                  indent: entry.indent,
                });
              } else {
                pdfIdx++;
                items.push({
                  id: `pdf:${pdfIdx}`,
                  label: entry.name || `Page ${pdfIdx}`,
                  type: 'pdf',
                  indent: entry.indent,
                });
              }
            }
          }
        }

        // 3. Fetch text pages
        const textEndpoint = entityType === 'template'
          ? `/api/templates/text-pages?template_id=${entityId}`
          : entityType === 'proposal'
            ? `/api/proposals/text-pages?proposal_id=${entityId}`
            : `/api/documents/text-pages?document_id=${entityId}`;

        try {
          const textRes = await fetch(textEndpoint);
          if (textRes.ok) {
            const textData = await textRes.json();
            if (Array.isArray(textData)) {
              for (const tp of textData) {
                if (tp.enabled) {
                  items.push({
                    id: `text:${tp.id}`,
                    label: tp.title || 'Text Page',
                    type: 'text',
                    indent: 0,
                  });
                }
              }
            }
          }
        } catch { /* non-critical */ }

        // 4. Fetch pricing
        const pricingEndpoint = entityType === 'template'
          ? `/api/templates/pricing?template_id=${entityId}`
          : `/api/proposals/pricing?proposal_id=${entityId}`;

        if (entityType !== 'document') {
          try {
            const pricingRes = await fetch(pricingEndpoint);
            if (pricingRes.ok) {
              const pricingData = await pricingRes.json();
              if (pricingData?.enabled) {
                items.push({
                  id: 'pricing',
                  label: pricingData.title || 'Your Investment',
                  type: 'pricing',
                  indent: 0,
                });
              }
            }
          } catch { /* non-critical */ }
        }

        // 5. Fetch packages (proposals + templates only)
        if (entityType !== 'document') {
          const pkgTable = entityType === 'template' ? 'template_packages' : 'proposal_packages';
          const pkgCol = entityType === 'template' ? 'template_id' : 'proposal_id';
          try {
            const { data: pkgData } = await supabase
              .from(pkgTable)
              .select('enabled, title')
              .eq(pkgCol, entityId)
              .single();

            if (pkgData?.enabled) {
              items.push({
                id: 'packages',
                label: pkgData.title || 'Packages',
                type: 'packages',
                indent: 0,
              });
            }
          } catch { /* non-critical */ }
        }

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

  const save = useCallback(async (newSettings: TocSettings) => {
    setSaveStatus('saving');
    try {
      const table = tableName(entityType);
      const { error } = await supabase
        .from(table)
        .update({ toc_settings: newSettings })
        .eq('id', entityId);

      if (error) throw error;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save table of contents settings');
      setSaveStatus('idle');
    }
  }, [entityId, entityType, toast]);

  const scheduleSave = useCallback((newSettings: TocSettings) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(newSettings);
      debounceRef.current = null;
    }, 800);
  }, [save]);

  const updateSettings = useCallback((changes: Partial<TocSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /* ── Toggle item inclusion ──────────────────────────────────── */

  const toggleItem = useCallback((itemId: string) => {
    setSettings((prev) => {
      const excluded = new Set(prev.excluded_items);
      if (excluded.has(itemId)) {
        excluded.delete(itemId);
      } else {
        excluded.add(itemId);
      }
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
        excluded_items: allExcluded ? [] : tocItems.map((item) => item.id),
      };
      scheduleSave(next);
      return next;
    });
  }, [tocItems, scheduleSave]);

  /* ── Derived state ──────────────────────────────────────────── */

  const excludedSet = useMemo(() => new Set(settings.excluded_items), [settings.excluded_items]);
  const includedCount = tocItems.filter((item) => !excludedSet.has(item.id)).length;
  const allIncluded = tocItems.length > 0 && includedCount === tocItems.length;
  const noneIncluded = includedCount === 0;

  /* ── Render ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          {/* Save status */}
          {saveStatus === 'saving' && (
            <span className="text-xs text-gray-400">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <Check size={12} /> Saved
            </span>
          )}

          {/* Toggle */}
          <button
            onClick={() => updateSettings({ enabled: !settings.enabled })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              settings.enabled ? 'bg-[#017C87]' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {settings.enabled ? (
        <div className="space-y-6">
          {/* Title */}
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

          {/* Page checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Pages to Include</label>
                <p className="text-xs text-gray-400 mt-0.5">
                  {includedCount} of {tocItems.length} pages selected
                </p>
              </div>
              <button
                onClick={toggleAll}
                className="text-xs font-medium text-[#017C87] hover:text-[#017C87]/80 transition-colors"
              >
                {allIncluded ? 'Deselect All' : noneIncluded ? 'Select All' : 'Select All'}
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {tocItems.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">No pages found</p>
                  <p className="text-xs text-gray-300 mt-1">Add PDF pages, text pages, or pricing to see them here</p>
                </div>
              ) : (
                tocItems.map((item) => {
                  const isIncluded = !excludedSet.has(item.id);
                  const isGroup = item.type === 'group';

                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                        isIncluded ? '' : 'opacity-50'
                      }`}
                      style={{ paddingLeft: `${16 + item.indent * 20}px` }}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isIncluded
                            ? 'bg-[#017C87] border-[#017C87]'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isIncluded && <Check size={10} className="text-white" />}
                      </div>

                      {/* Icon + label */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isGroup ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                            Section
                          </span>
                        ) : item.type === 'pricing' ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Pricing
                          </span>
                        ) : item.type === 'packages' ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            Packages
                          </span>
                        ) : item.type === 'text' ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            Text
                          </span>
                        ) : null}

                        <span className={`text-sm truncate ${isGroup ? 'font-medium text-gray-700' : 'text-gray-600'}`}>
                          {item.label}
                        </span>
                      </div>

                      {/* Visibility indicator */}
                      {isIncluded ? (
                        <Eye size={14} className="text-gray-300 shrink-0" />
                      ) : (
                        <EyeOff size={14} className="text-gray-200 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
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