// components/admin/builder-sections/PackagesSection.tsx
// Quote-style replacement for PackagesTabEditor. Same data layer
// (usePackagesEditor + TierEditor + PackagesAppearanceSection), wrapped in
// SectionCard chrome to match the Quote builder aesthetic.
'use client';

import { useState } from 'react';
import { Loader2, Package, Plus, Trash2, Eye, FileText, LayoutGrid } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import Chip from '@/components/ui/Chip';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import TierEditor from '@/components/admin/shared/TierEditor';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { usePackagesEditor, type UsePackagesEditorOptions } from '@/components/admin/shared/usePackagesEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';

export type PackagesSectionProps = UsePackagesEditorOptions;

export default function PackagesSection(props: PackagesSectionProps) {
  const editor = usePackagesEditor(props);
  useReportSaveStatus(editor.saveStatus);

  const [showPreview, setShowPreview] = useState(true);

  /* ── Loading ────────────────────────────────────────────────── */

  if (!editor.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  /* ── Page strip ─────────────────────────────────────────────── */

  const pageStrip = (
    <div className="flex items-end gap-0 border-b border-gray-200 overflow-x-auto">
      {editor.allPages.map((page) => (
        <button
          key={page.id}
          onClick={() => editor.selectPage(page)}
          className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            editor.selectedId === page.id
              ? 'text-teal border-b-2 border-teal -mb-px'
              : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'
          }`}
        >
          <Package size={13} className="shrink-0 opacity-70" />
          <span className="truncate max-w-[160px]">{page.title || 'Untitled'}</span>
          {!page.enabled && <span className="text-[10px] opacity-40 ml-0.5">(off)</span>}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); editor.deletePage(page.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
          >
            <Trash2 size={11} />
          </span>
        </button>
      ))}
      {editor.allPages.length === 0 && (
        <span className="px-4 py-2.5 text-xs text-gray-400">No pages yet — add one to get started</span>
      )}
      <button
        onClick={editor.addPage}
        disabled={editor.adding}
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/5 transition-colors disabled:opacity-50 shrink-0 border-b-2 border-transparent -mb-px"
      >
        {editor.adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Add Page
      </button>
      {editor.selectedId && (
        <div className="ml-auto flex items-center pr-1 pb-1.5">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showPreview ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
            }`}
          >
            <Eye size={13} /> Preview
          </button>
        </div>
      )}
    </div>
  );

  /* ── Empty state ────────────────────────────────────────────── */

  if (!editor.selectedId || !editor.selectedPage) {
    return (
      <div className="space-y-5">
        {pageStrip}
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Package size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 mb-1">No packages page selected</p>
          <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
        </div>
      </div>
    );
  }

  /* ── Editor + preview ───────────────────────────────────────── */

  const showPreviewPane = showPreview && editor.form.enabled && !!editor.previewPackages;

  return (
    <div className="flex flex-col gap-5">
      {pageStrip}

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-5">
          {/* Enabled toggle */}
          <SectionCard
            title="Packages Page"
            description="Toggle visibility in the proposal viewer"
            icon={<Package size={14} className="text-gray-400" />}
            action={
              <Chip enabled={editor.form.enabled} onClick={() => editor.toggleEnabled()}>
                {editor.form.enabled ? 'Visible' : 'Hidden'}
              </Chip>
            }
          >
            {!editor.form.enabled && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                <p className="text-sm text-gray-400 mb-1">Packages page is currently disabled</p>
                <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
              </div>
            )}
            {editor.form.enabled && (
              <p className="text-xs text-gray-400">
                Configure the packages page below. Changes save automatically.
              </p>
            )}
          </SectionCard>

          {editor.form.enabled && (
            <>
              {/* Page Content (title + intro + footer) */}
              <SectionCard
                title="Page Content"
                description="Headline, intro and footer copy"
                icon={<FileText size={14} className="text-gray-400" />}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Page Title</label>
                    <input
                      type="text"
                      value={editor.form.title}
                      onChange={(e) => editor.updateForm({ title: e.target.value })}
                      placeholder="Your Investment"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Intro Text</label>
                    <textarea
                      value={editor.form.intro_text ?? ''}
                      onChange={(e) => editor.updateForm({ intro_text: e.target.value || null })}
                      placeholder="Optional introductory text above the packages…"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Footer Text</label>
                    <textarea
                      value={editor.form.footer_text ?? ''}
                      onChange={(e) => editor.updateForm({ footer_text: e.target.value || null })}
                      placeholder="Optional footer note below the packages…"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Tier editor */}
              <SectionCard
                title={`Packages (${editor.form.packages.length})`}
                description="Tiers, features, and recommended badges"
                icon={<LayoutGrid size={14} className="text-gray-400" />}
                action={
                  <button
                    onClick={editor.addTier}
                    className="flex items-center gap-1 text-xs font-medium text-teal hover:text-teal/80 transition-colors"
                  >
                    <Plus size={11} /> Add Package
                  </button>
                }
              >
                {editor.form.packages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                    <Package size={20} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">No packages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editor.form.packages.map((tier, idx) => (
                      <TierEditor
                        key={tier.id}
                        tier={tier}
                        tierIdx={idx}
                        totalTiers={editor.form.packages.length}
                        isExpanded={editor.expandedTiers.has(tier.id)}
                        onToggleExpand={() => editor.toggleTierExpanded(tier.id)}
                        onUpdate={(changes) => editor.updateTier(tier.id, changes)}
                        onToggleRecommended={() =>
                          editor.updateTier(tier.id, { is_recommended: !tier.is_recommended })
                        }
                        onMove={(dir) => editor.moveTier(tier.id, dir)}
                        onDuplicate={() => editor.duplicateTier(tier.id)}
                        onRemove={() => editor.deleteTier(tier.id)}
                        onAddFeature={() =>
                          editor.updateTier(tier.id, {
                            features: [...tier.features, { bold_prefix: null, text: '', children: [] }],
                          })
                        }
                        onUpdateFeature={(fi, changes) => {
                          const next = tier.features.map((f, i) => (i === fi ? { ...f, ...changes } : f));
                          editor.updateTier(tier.id, { features: next });
                        }}
                        onRemoveFeature={(fi) =>
                          editor.updateTier(tier.id, {
                            features: tier.features.filter((_, i) => i !== fi),
                          })
                        }
                        onAddCondition={() =>
                          editor.updateTier(tier.id, {
                            conditions: [...tier.conditions, ''],
                          })
                        }
                        onUpdateCondition={(ci, val) => {
                          const next = [...tier.conditions];
                          next[ci] = val;
                          editor.updateTier(tier.id, { conditions: next });
                        }}
                        onRemoveCondition={(ci) =>
                          editor.updateTier(tier.id, {
                            conditions: tier.conditions.filter((_, i) => i !== ci),
                          })
                        }
                        onAddChild={(fi) => {
                          const next = tier.features.map((f, i) =>
                            i === fi ? { ...f, children: [...(f.children ?? []), ''] } : f,
                          );
                          editor.updateTier(tier.id, { features: next });
                        }}
                        onUpdateChild={(fi, ci, val) => {
                          const next = tier.features.map((f, i) => {
                            if (i !== fi) return f;
                            const ch = [...(f.children ?? [])];
                            ch[ci] = val;
                            return { ...f, children: ch };
                          });
                          editor.updateTier(tier.id, { features: next });
                        }}
                        onRemoveChild={(fi, ci) => {
                          const next = tier.features.map((f, i) => {
                            if (i !== fi) return f;
                            return { ...f, children: (f.children ?? []).filter((_, j) => j !== ci) };
                          });
                          editor.updateTier(tier.id, { features: next });
                        }}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Appearance moved to the Design tab — Packages Page section. */}
            </>
          )}
        </div>

        {showPreviewPane && (
          <StickyPreviewAside>
            <PackagesPreview packages={editor.previewPackages!} branding={editor.branding} />
          </StickyPreviewAside>
        )}
      </div>
    </div>
  );
}
