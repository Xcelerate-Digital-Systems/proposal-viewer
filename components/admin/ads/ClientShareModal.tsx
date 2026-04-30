// components/admin/ads/ClientShareModal.tsx
'use client';

import { useState } from 'react';
import { X, Copy, Check, Sparkles, Link2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = {
  trackerId: string;
  clientName: string;
  initialToken: string | null;
  onClose: () => void;
  onTokenChange: (token: string | null) => void;
};

export default function ClientShareModal({
  trackerId, clientName, initialToken, onClose, onTokenChange,
}: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'view' | 'ai' | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const viewUrl = token ? `${appUrl}/ads/view/${token}` : '';
  const aiUrl = token ? `${appUrl}/ads/view/${token}/ai` : '';

  const authFetch = async (method: 'POST' | 'DELETE') => {
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
    if (!accessToken) throw new Error('Not authenticated');
    return fetch(`/api/ads/tracker/${trackerId}/share`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  };

  const handleGenerate = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await authFetch('POST');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate');
      setToken(json.token);
      onTokenChange(json.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Revoke this share link? Existing recipients will lose access.')) return;
    setWorking(true);
    setError(null);
    try {
      const res = await authFetch('DELETE');
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to revoke');
      }
      setToken(null);
      onTokenChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setWorking(false);
    }
  };

  const copy = (text: string, which: 'view' | 'ai') => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-ink">Share ad tracker</h2>
            <p className="text-[12px] text-faint mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!token ? (
            <>
              <p className="text-[13px] text-muted">
                Generate a read-only public link so clients and AI tools can view every ad,
                strategy, and decision for <span className="font-medium text-ink">{clientName}</span>.
              </p>
              <button
                onClick={handleGenerate}
                disabled={working}
                className="w-full flex items-center justify-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors disabled:opacity-50"
              >
                <Link2 size={16} />
                {working ? 'Generating…' : 'Generate share link'}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted mb-1.5">
                  <Link2 size={13} />
                  Share link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={viewUrl}
                    className="flex-1 px-3 py-2 bg-surface border border-gray-100 rounded-[10px] text-[12px] text-ink outline-none"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => copy(viewUrl, 'view')}
                    className="shrink-0 w-[36px] h-[36px] rounded-[10px] bg-surface hover:bg-edge flex items-center justify-center text-muted transition-colors"
                    title="Copy"
                  >
                    {copied === 'view' ? <Check size={15} className="text-teal" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted mb-1.5">
                  <Sparkles size={13} />
                  AI-friendly link <span className="text-faint font-normal">(markdown / JSON)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={aiUrl}
                    className="flex-1 px-3 py-2 bg-surface border border-gray-100 rounded-[10px] text-[12px] text-ink outline-none"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => copy(aiUrl, 'ai')}
                    className="shrink-0 w-[36px] h-[36px] rounded-[10px] bg-surface hover:bg-edge flex items-center justify-center text-muted transition-colors"
                    title="Copy"
                  >
                    {copied === 'ai' ? <Check size={15} className="text-teal" /> : <Copy size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-faint mt-1.5">
                  Opens a plain-text view you can copy into ChatGPT, Claude, or any AI chat.
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={handleRevoke}
                  disabled={working}
                  className="flex items-center gap-2 text-[13px] text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {working ? 'Revoking…' : 'Revoke link'}
                </button>
              </div>
            </>
          )}

          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
