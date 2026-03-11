// components/admin/settings/WebhookEventCard.tsx
'use client';

import { useState } from 'react';
import {
  Trash2, Copy, Check, Eye, EyeOff, RefreshCw,
  Loader2, Send, type LucideIcon,
} from 'lucide-react';
import { supabase, type WebhookEndpoint } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { isValidWebhookUrl } from '@/lib/sanitize';

interface WebhookEventCardProps {
  eventKey: string;
  label: string;
  description: string;
  icon: LucideIcon;
  endpoint: WebhookEndpoint | null;
  companyId: string;
  onRefresh: () => void;
}

export default function WebhookEventCard({
  eventKey,
  label,
  description,
  icon: Icon,
  endpoint,
  companyId,
  onRefresh,
}: WebhookEventCardProps) {
  const toast = useToast();
  const [url, setUrl] = useState(endpoint?.url || '');
  const [secret, setSecret] = useState(endpoint?.secret || '');
  const [enabled, setEnabled] = useState(endpoint?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasEndpoint = !!endpoint;
  const urlChanged = url.trim() !== (endpoint?.url || '');
  const secretChanged = secret.trim() !== (endpoint?.secret || '');
  const enabledChanged = hasEndpoint && enabled !== endpoint.enabled;
  const hasChanges = urlChanged || secretChanged || enabledChanged;
  const hasUrl = url.trim().length > 0;

  const generateSecret = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    setSecret(Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(''));
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTest = async () => {
    if (!endpoint) return;
    setSendingTest(true);
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_id: endpoint.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`Test payload sent — server responded ${data.status}`);
      } else if (res.ok && !data.ok) {
        toast.error(`Endpoint returned ${data.status}`);
      } else {
        toast.error(data.error || 'Failed to send test payload');
      }
    } catch {
      toast.error('Network error sending test payload');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      if (hasEndpoint) {
        await handleRemove();
      }
      return;
    }

    if (!isValidWebhookUrl(url.trim())) {
      toast.error('Please enter a valid public URL (http or https)');
      return;
    }

    setSaving(true);

    if (hasEndpoint) {
      const { error } = await supabase
        .from('webhook_endpoints')
        .update({
          url: url.trim(),
          secret: secret.trim() || null,
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', endpoint.id);

      if (error) {
        toast.error('Failed to save webhook');
      } else {
        toast.success(`${label} webhook saved`);
      }
    } else {
      const { error } = await supabase
        .from('webhook_endpoints')
        .insert({
          company_id: companyId,
          event_type: eventKey,
          url: url.trim(),
          secret: secret.trim() || null,
          enabled,
        });

      if (error) {
        toast.error('Failed to save webhook');
      } else {
        toast.success(`${label} webhook created`);
      }
    }

    setSaving(false);
    onRefresh();
  };

  const handleRemove = async () => {
    if (!hasEndpoint) return;
    setSaving(true);
    await supabase.from('webhook_endpoints').delete().eq('id', endpoint.id);
    setUrl('');
    setSecret('');
    setEnabled(true);
    setShowSecret(false);
    toast.success(`${label} webhook removed`);
    setSaving(false);
    onRefresh();
  };

  const handleToggleEnabled = async () => {
    if (!hasEndpoint) return;
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    await supabase
      .from('webhook_endpoints')
      .update({ enabled: newEnabled, updated_at: new Date().toISOString() })
      .eq('id', endpoint.id);
    onRefresh();
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-opacity ${hasEndpoint && !enabled ? 'opacity-60' : ''}`}>
      <div className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon size={16} className={hasEndpoint && enabled ? 'text-[#017C87]' : 'text-gray-300'} />
          <div>
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasEndpoint && (
            <>
              <button
                onClick={handleToggleEnabled}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  enabled ? 'bg-[#017C87]' : 'bg-gray-200'
                }`}
                title={enabled ? 'Disable webhook' : 'Enable webhook'}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5 shadow-sm ${
                    enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <button
                onClick={handleRemove}
                disabled={saving}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove webhook"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 space-y-2.5">
        <div>
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Endpoint URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Signing Secret <span className="text-gray-300 normal-case">(optional)</span>
          </label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Used to verify webhook authenticity"
                className="w-full px-3 py-2 pr-16 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400 placeholder:font-sans"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
                {secret && (
                  <button
                    type="button"
                    onClick={copySecret}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                    title="Copy secret"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={generateSecret}
              className="px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              title="Generate random secret"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {hasEndpoint && enabled && !hasChanges && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSendTest}
              disabled={sendingTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:text-[#017C87] hover:border-[#017C87]/40 hover:bg-[#017C87]/5 transition-colors disabled:opacity-50"
              title="Send a sample payload to this endpoint"
            >
              {sendingTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send test
            </button>
          </div>
        )}

        {hasChanges && hasUrl && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {hasEndpoint ? 'Save' : 'Create'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
