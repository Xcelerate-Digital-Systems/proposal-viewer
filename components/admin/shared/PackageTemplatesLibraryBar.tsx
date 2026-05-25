// components/admin/shared/PackageTemplatesLibraryBar.tsx
// Single-tier package templates. Two pieces:
//   • <PackageTemplatesLibraryBar> — "From Library" dropdown that inserts one
//     tier into the current packages page. Mirrors LineItemsLibraryBar.
//   • <SavePackageTemplateModal> — modal for naming and saving an individual
//     tier as a reusable template.
'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { PackageTier } from '@/lib/types/packages';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  tier: PackageTier;
  created_at: string;
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── Library dropdown ────────────────────────────────────────────── */

interface LibraryBarProps {
  onPick: (tier: PackageTier) => void;
}

export function PackageTemplatesLibraryBar({ onPick }: LibraryBarProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/package-templates', { headers: await authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setTemplates(json.templates ?? []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && templates.length === 0 && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const apply = (t: TemplateRow) => {
    const fresh: PackageTier = { ...t.tier, id: newId() };
    onPick(fresh);
    setOpen(false);
    toast.success(`Added "${t.name}"`);
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/package-templates/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted');
    } else {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-teal hover:text-teal/80 transition-colors"
      >
        <BookOpen size={11} /> From Library
        <ChevronDown size={11} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-80 bg-white rounded-lg border border-gray-200 shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              <Loader2 size={14} className="inline animate-spin" /> Loading…
            </div>
          ) : templates.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              No saved packages yet. Open a package and click &ldquo;Save as Template&rdquo;.
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-gray-50 group"
              >
                <button
                  type="button"
                  onClick={() => apply(t)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">{t.name}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.tier?.name || 'Package'} · {(t.tier?.features?.length ?? 0)} feature
                    {(t.tier?.features?.length ?? 0) === 1 ? '' : 's'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500"
                  title="Delete template"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Save modal ─────────────────────────────────────────────────── */

interface SaveModalProps {
  tier: PackageTier | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function SavePackageTemplateModal({ tier, onClose, onSaved }: SaveModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tier) setName(tier.name || '');
  }, [tier]);

  if (!tier) return null;

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/package-templates', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ name: name.trim(), tier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(`Template "${name}" saved`);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[400px] bg-white rounded-xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Save package as template</h3>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          Template name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Local SEO Bronze"
          className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-2">
          Saves &ldquo;{tier.name || 'this package'}&rdquo; with its price, features and conditions. It will appear in
          the &ldquo;From Library&rdquo; menu on any packages page.
        </p>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal text-white rounded-md text-xs font-medium hover:bg-[#01434A] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
