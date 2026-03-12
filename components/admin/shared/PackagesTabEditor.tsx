// components/admin/shared/PackagesTabEditor.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, Loader2, Package, Plus, Trash2, Eye } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import { PackageTier, PackageStyling } from '@/lib/supabase';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import PackagesAppearanceSection from '@/components/admin/shared/PackagesAppearanceSection';
import TierEditor from '@/components/admin/shared/TierEditor';
import SplitPanelLayout from '@/components/admin/shared/SplitPanelLayout';
import { usePackagesEditor, type UsePackagesEditorOptions } from './usePackagesEditor';

/* ─── Props ───────────────────────────────────────────────────── */

export type PackagesTabEditorProps = UsePackagesEditorOptions;

/* ─── Component ───────────────────────────────────────────────── */

export default function PackagesTabEditor(props: PackagesTabEditorProps) {
  const editor = usePackagesEditor(props);

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(520);
  const [showPreview, setShowPreview] = useState(true);

  /* ── Panel height ───────────────────────────────────────────── */

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const top = containerRef.current.getBoundingClientRect().top;
        setPanelHeight(Math.max(400, window.innerHeight - top - 24));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* ── Loading ────────────────────────────────────────────────── */

  if (!editor.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Packages Pages</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {editor.allPages.length === 0
              ? 'No packages pages yet'
              : `${editor.allPages.filter((p) => p.enabled).length} of ${editor.allPages.length} enabled`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editor.saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-gray-300" />}
          {editor.saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} /> Saved
            </span>
          )}
          {editor.selectedId && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview
                  ? 'bg-teal/10 text-teal'
                  : 'bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
            >
              <Eye size={13} /> Preview
            </button>
          )}
        </div>
      </div>

      {/* Page navigation bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {editor.allPages.map((page) => (
          <button
            key={page.id}
            onClick={() => editor.selectPage(page)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${
              editor.selectedId === page.id
                ? 'bg-teal/10 border-teal/30 text-teal'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="truncate max-w-[140px]">{page.title || 'Untitled'}</span>
            {!page.enabled && <span className="text-[10px] opacity-50 ml-0.5">(off)</span>}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                editor.deletePage(page.id);
              }}
              className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
            >
              <Trash2 size={10} />
            </span>
          </button>
        ))}
        {editor.allPages.length === 0 && (
          <span className="text-xs text-gray-400">No pages yet — add one to get started</span>
        )}
        <button
          onClick={editor.addPage}
          disabled={editor.adding}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-teal border border-dashed border-teal/30 hover:bg-teal/5 transition-colors disabled:opacity-50"
        >
          {editor.adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Add Page
        </button>
      </div>

      {/* Body: editor + optional preview */}
      <SplitPanelLayout
        containerRef={containerRef}
        panelHeight={panelHeight}
        gap="gap-5"
        leftClassName="overflow-y-auto"
        left={
          editor.selectedId && editor.selectedPage ? (
            <>
              {/* Enabled toggle */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Show packages page</p>
                  <p className="text-xs text-gray-400 mt-0.5">Toggle visibility in the proposal viewer</p>
                </div>
                <Toggle enabled={editor.form.enabled} onChange={() => editor.toggleEnabled()} />
              </div>

              {editor.form.enabled ? (
                <div className="space-y-5">
                  {/* Page title */}
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

                  {/* Intro text */}
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

                  {/* Tier editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">
                        Packages ({editor.form.packages.length})
                      </label>
                      <button
                        onClick={editor.addTier}
                        className="flex items-center gap-1 text-xs font-medium text-teal hover:text-teal/80 transition-colors"
                      >
                        <Plus size={11} /> Add Package
                      </button>
                    </div>

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
                  </div>

                  {/* Footer text */}
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

                  {/* Appearance */}
                  <PackagesAppearanceSection
                    styling={editor.form.styling}
                    tiers={editor.form.packages}
                    onStylingChange={(newStyling: PackageStyling) => editor.updateForm({ styling: newStyling })}
                    onTierChange={(tierId: string, changes: Partial<PackageTier>) =>
                      editor.updateTier(tierId, changes)
                    }
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                  <Package size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400 mb-1">Packages page is currently disabled</p>
                  <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Package size={28} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400 mb-1">No packages page selected</p>
                <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
              </div>
            </div>
          )
        }
        right={
          showPreview && editor.selectedId && editor.form.enabled && editor.previewPackages ? (
            <PackagesPreview packages={editor.previewPackages} branding={editor.branding} />
          ) : undefined
        }
      />
    </div>
  );
}
