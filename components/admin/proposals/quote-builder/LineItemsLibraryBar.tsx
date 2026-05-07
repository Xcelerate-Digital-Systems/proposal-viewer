// components/admin/proposals/quote-builder/LineItemsLibraryBar.tsx
'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Save, ChevronDown, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { PricingLineItem } from '@/lib/types/packages';

interface LineItemsLibraryBarProps {
  items: PricingLineItem[];
  replaceItems: (items: PricingLineItem[]) => void;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  items: PricingLineItem[];
  created_at: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function regenIds(items: PricingLineItem[]): PricingLineItem[] {
  return items.map((it, i) => ({
    ...it,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `li_${Date.now()}_${i}`,
    sort_order: i,
  }));
}

export default function LineItemsLibraryBar({ items, replaceItems }: LineItemsLibraryBarProps) {
  const toast = useToast();
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/line-item-templates', { headers: await authHeaders() });
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
    if (showLibrary && templates.length === 0 && !loading) {
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLibrary]);

  const applyTemplate = (t: TemplateRow) => {
    replaceItems(regenIds(t.items));
    setShowLibrary(false);
    toast.success(`Loaded "${t.name}"`);
  };

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/line-item-templates/${id}`, {
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

  const saveTemplate = async () => {
    if (!saveName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (items.length === 0) {
      toast.error('No line items to save');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/line-item-templates', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ name: saveName.trim(), items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(`Template "${saveName}" saved`);
      setSaveName('');
      setShowSave(false);
      // Reset cache so next library open refetches
      setTemplates([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowLibrary((v) => !v);
            setShowSave(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-gray-300 transition-colors"
        >
          <BookOpen size={12} />
          From Library
          <ChevronDown size={12} className="text-gray-400" />
        </button>
        {showLibrary && (
          <div className="absolute z-20 mt-1 w-80 bg-white rounded-lg border border-gray-200 shadow-lg max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                <Loader2 size={14} className="inline animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                No saved templates yet. Add line items, then click "Save as Template".
              </div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-gray-50 group"
                >
                  <button
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">{t.name}</div>
                    <div className="text-xs text-gray-400">
                      {t.items.length} item{t.items.length === 1 ? '' : 's'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(t.id)}
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

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowSave((v) => !v);
            setShowLibrary(false);
          }}
          disabled={items.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={12} />
          Save as Template
        </button>
        {showSave && (
          <div className="absolute z-20 mt-1 w-72 bg-white rounded-lg border border-gray-200 shadow-lg p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Template name
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Bathroom Renovation Standard"
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Saving {items.length} line item{items.length === 1 ? '' : 's'}.
            </p>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowSave(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal text-white rounded-md text-xs font-medium hover:bg-[#01434A] disabled:opacity-50"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
