// components/admin/ads/TargetMarketsTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdTargetMarket } from '@/lib/types/ads';

type Props = {
  companyId: string;
  trackerId?: string;
};

export default function TargetMarketsTab({ companyId, trackerId }: Props) {
  const [markets, setMarkets] = useState<AdTargetMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchMarkets = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    const params = new URLSearchParams({ company_id: companyId });
    if (trackerId) params.set('tracker_id', trackerId);
    const res = await fetch(`/api/ads/target-markets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) setMarkets(json.data);
    setLoading(false);
  }, [companyId, trackerId]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setAdding(false); return; }

    const res = await fetch('/api/ads/target-markets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null, tracker_id: trackerId || null }),
    });
    const json = await res.json();
    if (json.success) {
      setMarkets((prev) => [...prev, json.data]);
      setNewName('');
      setNewDescription('');
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    await fetch(`/api/ads/target-markets/${id}?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMarkets((prev) => prev.filter((m) => m.id !== id));
  };

  const startEdit = (m: AdTargetMarket) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditDescription(m.description || '');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    const res = await fetch(`/api/ads/target-markets/${editingId}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null }),
    });
    const json = await res.json();
    if (json.success) {
      setMarkets((prev) => prev.map((m) => (m.id === editingId ? json.data : m)));
    }
    setEditingId(null);
  };

  const inputClass =
    'w-full px-3 py-2 bg-surface border border-edge rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="text-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-base font-semibold text-ink mb-1">Target Markets</h2>
      <p className="text-[12px] text-faint mb-5">
        Define your target market segments. These will appear as dropdown options when creating ad creatives.
      </p>

      {/* Add new */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Market name, e.g. Women Coach & Consultant Broad"
            className={inputClass}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className={inputClass}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || adding}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>

      {/* List */}
      {markets.length === 0 ? (
        <p className="text-[13px] text-faint py-8 text-center">No target markets yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {markets.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-3 bg-surface/50 border border-edge rounded-xl group"
            >
              {editingId === m.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass + ' flex-1'}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={inputClass + ' flex-1'}
                    placeholder="Description (optional)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    onClick={saveEdit}
                    className="text-[12px] font-medium text-teal hover:text-teal-hover shrink-0"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-[12px] font-medium text-muted hover:text-ink shrink-0"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => startEdit(m)}
                  >
                    <span className="text-[13px] font-medium text-ink">{m.name}</span>
                    {m.description && (
                      <span className="text-[12px] text-faint ml-2">{m.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-faint hover:text-red-500 rounded transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
