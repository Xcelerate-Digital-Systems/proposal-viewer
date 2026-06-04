'use client';

import { useState, useRef, useEffect } from 'react';
import { LifeBuoy, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing' },
];

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open]);

  const reset = () => {
    setSubject('');
    setDescription('');
    setCategory('general');
    setSent(false);
  };

  const submit = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSending(true);
    try {
      const res = await authFetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), description: description.trim(), category }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { setOpen(false); reset(); }, 2000);
      }
    } catch { /* swallow */ }
    setSending(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (sent) reset(); }}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-teal text-white shadow-lg hover:bg-teal/90 transition-all flex items-center justify-center print:hidden"
        aria-label="Support"
      >
        {open ? <X size={20} /> : <LifeBuoy size={20} />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-40 w-80 bg-white border border-edge rounded-2xl shadow-popover overflow-hidden print:hidden"
        >
          <div className="px-4 py-3 border-b border-edge bg-surface/50">
            <h3 className="text-sm font-semibold text-ink">Contact Support</h3>
            <p className="text-xs text-faint">We typically respond within 24 hours.</p>
          </div>

          {sent ? (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-ink">Ticket submitted</p>
              <p className="text-xs text-faint mt-1">We&apos;ll get back to you soon.</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-prose mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-prose mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary"
                  className="w-full px-3 py-1.5 text-sm border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-prose mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue or request"
                  rows={4}
                  className="w-full px-3 py-1.5 text-sm border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1 pb-1">
                <a
                  href="/support"
                  className="text-xs text-teal hover:underline"
                >
                  View tickets
                </a>
                <button
                  type="button"
                  onClick={submit}
                  disabled={sending || !subject.trim() || !description.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
