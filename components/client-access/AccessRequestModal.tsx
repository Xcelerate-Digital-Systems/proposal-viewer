'use client';

import { useState } from 'react';
import { X, Send, Copy, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { VALID_PLATFORMS, PLATFORM_LABELS, type AccessPlatform } from '@/lib/client-access/types';
import { authFetch } from '@/lib/auth-fetch';

interface AccessRequestModalProps {
  clientId?: string;
  clientName?: string;
  onClose: () => void;
  onCreated: () => void;
}

type ModalStep = 'form' | 'success';

export default function AccessRequestModal({
  clientId,
  clientName,
  onClose,
  onCreated,
}: AccessRequestModalProps) {
  const [step, setStep] = useState<ModalStep>('form');
  const [selectedPlatforms, setSelectedPlatforms] = useState<AccessPlatform[]>([]);
  const [recipientName, setRecipientName] = useState(clientName || '');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const togglePlatform = (p: AccessPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await authFetch('/api/client-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || undefined,
          platforms: selectedPlatforms,
          client_name: recipientName.trim() || undefined,
          client_email: recipientEmail.trim() || undefined,
          notes: notes.trim() || undefined,
          expires_in_days: expiresInDays,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to create access request');
        return;
      }

      const data = await res.json();
      const url = `${window.location.origin}/access/${data.share_token}`;
      setShareUrl(url);
      setStep('success');
    } catch {
      setError('Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) return;
    setSendingEmail(true);

    try {
      await authFetch('/api/client-access/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_url: shareUrl,
          client_email: recipientEmail.trim(),
          client_name: recipientName.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      setEmailSent(true);
    } catch {
      // silently fail email — the link is already created
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDone = () => {
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">
            {step === 'form' ? 'Request Client Access' : 'Access Link Created'}
          </h2>
          <button onClick={step === 'form' ? onClose : handleDone} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Client Name</label>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Client Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">Platforms to connect</label>
              <div className="space-y-2">
                {VALID_PLATFORMS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{
                      backgroundColor: selectedPlatforms.includes(p) ? '#017C8715' : '#ffffff06',
                      borderWidth: 1,
                      borderColor: selectedPlatforms.includes(p) ? '#017C8740' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-white">{PLATFORM_LABELS[p]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Message (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Hi! Please connect these accounts so we can get started..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Link expires in</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={sending}
              leftIcon={Send}
            >
              Create Access Link
            </Button>
          </form>
        )}

        {step === 'success' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Link2 size={18} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">
                Access link created. Copy it below or send it directly via email.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Share link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono truncate focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  leftIcon={copied ? Check : Copy}
                  onClick={handleCopy}
                  aria-label="Copy link"
                />
              </div>
            </div>

            {recipientEmail.trim() && (
              <div>
                {emailSent ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Check size={14} />
                    <span>Email sent to {recipientEmail}</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={Send}
                    loading={sendingEmail}
                    onClick={handleSendEmail}
                  >
                    Send link to {recipientEmail}
                  </Button>
                )}
              </div>
            )}

            <Button variant="primary" fullWidth onClick={handleDone}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
