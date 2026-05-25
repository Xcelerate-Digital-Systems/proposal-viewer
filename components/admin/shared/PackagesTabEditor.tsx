// components/admin/shared/PackagesTabEditor.tsx
'use client';

import { useState } from 'react';
import { Check, Loader2, Package, Plus } from 'lucide-react';
import BuilderPageStrip from '@/components/admin/shared/BuilderPageStrip';
import TextInput from '@/components/ui/TextInput';
import Textarea from '@/components/ui/Textarea';
import Chip from '@/components/ui/Chip';
import { PackageTier, PackageStyling } from '@/lib/supabase';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import PackagesAppearanceSection from '@/components/admin/shared/PackagesAppearanceSection';
import TierEditor from '@/components/admin/shared/TierEditor';
import {
  PackageTemplatesLibraryBar,
  SavePackageTemplateModal,
} from '@/components/admin/shared/PackageTemplatesLibraryBar';
import { usePackagesEditor, type UsePackagesEditorOptions } from './usePackagesEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';

/* ─── Props ───────────────────────────────────────────────────── */

export type PackagesTabEditorProps = UsePackagesEditorOptions;

/* ─── Component ───────────────────────────────────────────────── */

export default function PackagesTabEditor(props: PackagesTabEditorProps) {
  const editor = usePackagesEditor(props);
  useReportSaveStatus(editor.saveStatus);

  const [showPreview, setShowPreview] = useState(true);
  const [tierToSave, setTierToSave] = useState<PackageTier | null>(null);

  /* ── Loading ────────────────────────────────────────────────── */

  if (!editor.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const previewVisible = showPreview && editor.selectedId && editor.form.enabled && !!editor.previewPackages;

  return (
    <div className="flex flex-col gap-5">
      {/* Page navigation tabs */}
      <BuilderPageStrip
        pages={editor.allPages}
        selectedId={editor.selectedId}
        onSelect={(p) => {
          const full = editor.allPages.find((x) => x.id === p.id);
          if (full) editor.selectPage(full);
        }}
        onDelete={editor.deletePage}
        onAdd={editor.addPage}
        adding={editor.adding}
        icon={Package}
        previewVisible={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
      />

      {/* Body: editor + optional sticky preview (matches Cover/Design/Quote shell) */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {editor.selectedId && editor.selectedPage ? (
            <>
              {/* Show-on-viewer chip (replaces the old slidey Toggle) */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Show packages page</p>
                  <p className="text-xs text-gray-400 mt-0.5">Toggle visibility in the proposal viewer</p>
                </div>
                <Chip enabled={editor.form.enabled} onClick={() => editor.toggleEnabled()}>
                  {editor.form.enabled ? 'Visible' : 'Hidden'}
                </Chip>
              </div>

              {editor.form.enabled ? (
                <div className="space-y-5">
                  <TextInput
                    label="Page Title"
                    value={editor.form.title}
                    onChange={(e) => editor.updateForm({ title: e.target.value })}
                    placeholder="Your Investment"
                  />
                  <Textarea
                    label="Intro Text"
                    value={editor.form.intro_text ?? ''}
                    onChange={(e) => editor.updateForm({ intro_text: e.target.value || null })}
                    placeholder="Optional introductory text above the packages…"
                    rows={2}
                  />

                  {/* Tier editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">
                        Packages ({editor.form.packages.length})
                      </label>
                      <div className="flex items-center gap-3">
                        <PackageTemplatesLibraryBar onPick={editor.insertTier} />
                        <button
                          onClick={editor.addTier}
                          className="flex items-center gap-1 text-xs font-medium text-teal hover:text-teal/80 transition-colors"
                        >
                          <Plus size={11} /> Add Package
                        </button>
                      </div>
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
                            onDuplicate={() => editor.duplicateTier(tier.id)}
                            onSaveAsTemplate={() => setTierToSave(tier)}
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
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Package size={28} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400 mb-1">No packages page selected</p>
                <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
              </div>
            </div>
          )}
        </div>

        {previewVisible && (
          <StickyPreviewAside>
            <PackagesPreview packages={editor.previewPackages!} branding={editor.branding} />
          </StickyPreviewAside>
        )}
      </div>

      <SavePackageTemplateModal
        tier={tierToSave}
        onClose={() => setTierToSave(null)}
      />
    </div>
  );
}
