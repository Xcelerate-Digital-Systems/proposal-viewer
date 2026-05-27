// components/admin/settings/ApiKeyManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Copy, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ApiKey {
  id: string;
  label: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [justCreated, setJustCreated] = useState<{ label: string; plaintext: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/settings/api-keys', { headers: await authHeader() });
    const json = await res.json();
    if (json.success) setKeys(json.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    const res = await fetch('/api/settings/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.success) {
      setJustCreated({ label: newLabel.trim(), plaintext: json.data.plaintext });
      setNewLabel('');
      load();
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? Any extension or integration using it will stop working.')) return;
    await fetch(`/api/settings/api-keys?id=${id}`, { method: 'DELETE', headers: await authHeader() });
    load();
  };

  const copy = () => {
    if (!justCreated) return;
    navigator.clipboard.writeText(justCreated.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const active = keys.filter((k) => !k.revoked_at);

  return (
    <div>
      {justCreated && (
        <div className="mb-4 p-4 bg-teal-tint border border-teal/30 rounded-2xl max-w-lg">
          <p className="text-xs font-semibold text-ink mb-1">Key created — copy it now</p>
          <p className="text-xs text-faint mb-3">
            This is the only time you'll see the full key. Store it somewhere safe.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-teal/20 rounded-lg text-xs font-mono text-ink overflow-x-auto whitespace-nowrap">
              {justCreated.plaintext}
            </code>
            <button
              onClick={copy}
              className="px-3 py-2 bg-teal text-white rounded-lg text-xs font-medium hover:bg-teal/90 flex items-center gap-1.5"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setJustCreated(null)}
            className="mt-3 text-xs text-faint hover:text-ink"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      <div className="max-w-lg">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Key label (e.g. Chrome extension)"
            className="flex-1 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button
            onClick={create}
            disabled={creating || !newLabel.trim()}
            className="px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-teal/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Generate
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-faint" />
          </div>
        ) : active.length === 0 ? (
          <p className="text-xs text-faint text-center py-6">No API keys yet</p>
        ) : (
          <div className="space-y-2">
            {active.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white border border-line rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{k.label}</p>
                  <p className="text-xs text-faint font-mono truncate">
                    {k.key_prefix}…
                    {k.last_used_at && (
                      <span className="ml-2 font-sans">
                        last used {new Date(k.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => revoke(k.id)}
                  className="p-1.5 text-faint hover:text-red-500 rounded"
                  title="Revoke"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
