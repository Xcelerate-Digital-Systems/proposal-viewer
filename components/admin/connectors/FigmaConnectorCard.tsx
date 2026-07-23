'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, ExternalLink, Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import Image from 'next/image';

interface FigmaConnection {
  id: string;
  figma_handle: string | null;
  figma_email: string | null;
  team_member_id: string;
  created_at: string;
}

export default function FigmaConnectorCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [connections, setConnections] = useState<FigmaConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await authFetch('/api/connectors/figma/connect');
      const data = await res.json();
      if (data.success) setConnections(data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/connectors/figma/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalAccessToken: tokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to connect');
        setSaving(false);
        return;
      }
      toast.success('Figma connected');
      setTokenInput('');
      setShowForm(false);
      fetchConnections();
    } catch {
      toast.error('Failed to connect');
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Figma',
      message: 'This will remove your Figma connection. Existing imported assets will not be affected.',
      confirmLabel: 'Disconnect',
    });
    if (!ok) return;
    try {
      await authFetch('/api/connectors/figma/connect', { method: 'DELETE' });
      toast.success('Figma disconnected');
      fetchConnections();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const myConnection = connections.length > 0 ? connections[0] : null;

  return (
    <div className="bg-surface rounded-2xl border border-edge overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-edge">
        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
          <Image src="/icons/brands/figma.svg" alt="Figma" width={22} height={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-caption font-semibold text-ink">Figma</h3>
          <p className="text-detail text-faint">Import Figma designs into Campaigns for review and annotation</p>
        </div>
        {myConnection && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-2xs font-medium">
            <Check size={10} />
            Connected
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-faint text-caption">
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </div>
        ) : myConnection ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption text-ink font-medium">
                  {myConnection.figma_handle || myConnection.figma_email || 'Connected'}
                </p>
                {myConnection.figma_email && myConnection.figma_handle && (
                  <p className="text-detail text-faint">{myConnection.figma_email}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                <Trash2 size={14} className="mr-1.5" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : showForm ? (
          <div className="space-y-3">
            <div>
              <label className="block text-caption font-medium text-ink mb-1">
                Personal Access Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="figd_..."
                className="w-full px-3 py-2 bg-white rounded-xl border border-edge text-caption focus:outline-none focus:ring-2 focus:ring-teal/30"
                onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                autoFocus
              />
              <p className="text-detail text-faint mt-1.5">
                Generate a token at{' '}
                <a
                  href="https://www.figma.com/developers/api#access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal hover:underline inline-flex items-center gap-0.5"
                >
                  Figma Settings → Personal Access Tokens
                  <ExternalLink size={10} />
                </a>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleConnect} disabled={!tokenInput.trim() || saving}>
                {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                Connect
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowForm(true)}>
            Connect Figma Account
          </Button>
        )}
      </div>
    </div>
  );
}
