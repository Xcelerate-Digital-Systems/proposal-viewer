// components/admin/proposals/quote-builder/LineItemsLibraryBar.tsx
'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Save, ChevronDown, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { PricingLineItem } from '@/lib/types/packages';
import { Button } from '@/components/ui/Button';

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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={BookOpen}
          rightIcon={ChevronDown}
          onClick={() => {
            setShowLibrary((v) => !v);
            setShowSave(false);
          }}
        >
          From Library
        </Button>
        {showLibrary && (
          <div className="absolute z-50 mt-1 w-80 bg-white rounded-lg border border-edge-strong shadow-lg max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-xs text-faint">
                <Loader2 size={14} className="inline animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-faint">
                No saved templates yet. Add line items, then click "Save as Template".
              </div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-surface group"
                >
                  <button
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-sm font-medium text-ink truncate">{t.name}</div>
                    <div className="text-xs text-faint">
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={Save}
          disabled={items.length === 0}
          onClick={() => {
            setShowSave((v) => !v);
            setShowLibrary(false);
          }}
        >
          Save as Template
        </Button>
        {showSave && (
          <div className="absolute z-50 mt-1 w-72 bg-white rounded-lg border border-edge-strong shadow-lg p-3">
            <label className="block text-xs font-medium text-prose mb-1.5">
              Template name
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Bathroom Renovation Standard"
              className="w-full px-2 py-1.5 rounded border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              autoFocus
            />
            <p className="text-xs text-faint mt-1.5">
              Saving {items.length} line item{items.length === 1 ? '' : 's'}.
            </p>
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSave(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                loading={saving}
                onClick={saveTemplate}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
