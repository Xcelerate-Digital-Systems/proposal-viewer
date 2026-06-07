'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquareText, Plus, ArrowLeft, Send, Clock, Loader2,
  CircleDot, CheckCircle2, AlertCircle, X, Paperclip, Image as ImageIcon, Video, Trash2, ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';

type Attachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

type Ticket = {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  loom_url: string | null;
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  sender_name: string;
  is_admin_reply: boolean;
  body: string;
  created_at: string;
};

type TicketDetail = Ticket & {
  support_ticket_messages: Message[];
};

export default function SupportPage() {
  return (
    <AdminLayout>
      {(auth) => <SupportContent companyId={auth.companyId ?? ''} />}
    </AdminLayout>
  );
}

function SupportContent({ companyId }: { companyId: string }) {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await authFetch(`/api/support/tickets?company_id=${companyId}`);
      if (res.ok) setTickets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  if (selectedId) {
    return (
      <div>
        <PageHeader title="Support" />
        <div className="px-6 lg:px-10 py-6">
          <TicketDetailView
            ticketId={selectedId}
            companyId={companyId}
            onBack={() => { setSelectedId(null); fetchTickets(); }}
          />
        </div>
      </div>
    );
  }

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div>
      <PageHeader
        title="Support"
        description={loading ? '' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}${openCount ? ` · ${openCount} open` : ''}`}
        actions={
          <Button leftIcon={Plus} size="sm" onClick={() => setShowCreate(true)}>
            New Ticket
          </Button>
        }
      />

      <div className="px-6 lg:px-10 py-6">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={20} className="animate-spin text-faint" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquareText size={28} className="text-faint mx-auto mb-3" />
            <h3 className="text-base font-semibold text-muted mb-1">No tickets yet</h3>
            <p className="text-sm text-faint mb-5">Need help? Submit a support ticket.</p>
            <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>
              New Ticket
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className="w-full text-left bg-white border border-edge rounded-xl p-4 hover:border-teal/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-faint font-mono">#{ticket.ticket_number}</span>
                  <StatusBadge status={ticket.status} />
                  <CategoryLabel category={ticket.category} />
                </div>
                <h4 className="text-sm font-medium text-ink">{ticket.subject}</h4>
                <div className="text-xs text-faint mt-1">
                  {timeAgo(ticket.created_at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTicketModal
          companyId={companyId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchTickets();
            toast.success('Ticket submitted');
          }}
        />
      )}
    </div>
  );
}

function TicketDetailView({
  ticketId,
  companyId,
  onBack,
}: {
  ticketId: string;
  companyId: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await authFetch(`/api/support/tickets/${ticketId}?company_id=${companyId}`);
      if (res.ok) setTicket(await res.json());
    } finally {
      setLoading(false);
    }
  }, [ticketId, companyId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/support/tickets/${ticketId}/messages?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (res.ok) {
        setReply('');
        fetchTicket();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  if (loading || !ticket) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 size={20} className="animate-spin text-faint" />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors mb-4"
      >
        <ArrowLeft size={13} />
        Back to tickets
      </button>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-faint font-mono">#{ticket.ticket_number}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <h2 className="text-lg font-semibold text-ink mb-1">{ticket.subject}</h2>
      <div className="text-xs text-faint mb-6">{timeAgo(ticket.created_at)}</div>

      {ticket.description && (
        <div className="bg-surface border border-edge rounded-xl p-4 mb-6">
          <p className="text-sm text-ink whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {ticket.loom_url && (
        <div className="mb-6">
          <label className="block text-xs font-medium text-muted mb-2">Loom Recording</label>
          <div className="rounded-xl overflow-hidden border border-edge" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              src={ticket.loom_url.replace('/share/', '/embed/')}
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}

      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="mb-6">
          <label className="block text-xs font-medium text-muted mb-2">Attachments</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ticket.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-edge rounded-xl overflow-hidden hover:border-teal/30 hover:shadow-sm transition-all"
              >
                {att.type.startsWith('image/') ? (
                  <img src={att.url} alt={att.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-surface flex items-center justify-center">
                    <Paperclip size={24} className="text-faint" />
                  </div>
                )}
                <div className="px-3 py-2">
                  <p className="text-xs text-ink truncate">{att.name}</p>
                  <p className="text-detail text-faint">{formatBytes(att.size)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {ticket.support_ticket_messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 ${
              msg.is_admin_reply
                ? 'bg-teal/5 border border-teal/20 ml-8'
                : 'bg-white border border-edge mr-8'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-ink">{msg.sender_name}</span>
              {msg.is_admin_reply && (
                <span className="text-detail font-semibold text-teal bg-teal/10 px-1.5 py-0.5 rounded">
                  Support
                </span>
              )}
              <span className="text-xs text-faint">{timeAgo(msg.created_at)}</span>
            </div>
            <p className="text-sm text-ink whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}

        {ticket.support_ticket_messages.length === 0 && (
          <p className="text-sm text-faint text-center py-4">
            We&apos;ll get back to you shortly.
          </p>
        )}
      </div>

      {ticket.status !== 'closed' && (
        <div className="bg-white border border-edge rounded-xl p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add a message..."
            rows={3}
            className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 resize-none mb-3"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              leftIcon={Send}
              loading={sending}
              disabled={!reply.trim()}
              onClick={handleSendReply}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTicketModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [loomUrl, setLoomUrl] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > 5) {
      setError('Maximum 5 attachments');
      return;
    }
    setUploading(true);
    setError('');

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      try {
        const res = await authFetch('/api/support/attachments', { method: 'POST', body: form });
        if (res.ok) {
          const att = await res.json();
          setAttachments((prev) => [...prev, att]);
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Failed to upload ${file.name}`);
        }
      } catch {
        setError(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!subject.trim()) return;
    if (loomUrl.trim() && !/^https:\/\/(www\.)?loom\.com\/share\/[a-zA-Z0-9]+/.test(loomUrl.trim())) {
      setError('Please enter a valid Loom share URL (https://www.loom.com/share/...)');
      return;
    }
    setSaving(true);
    setError('');

    const res = await authFetch(`/api/support/tickets?company_id=${companyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: subject.trim(),
        description: description.trim(),
        category,
        loom_url: loomUrl.trim() || null,
        attachments,
      }),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to create ticket');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-edge rounded-2xl shadow-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Support Ticket</h2>
          <button onClick={onClose} className="text-faint hover:text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            >
              <option value="general">General</option>
              <option value="billing">Billing</option>
              <option value="bug">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="account">Account</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue or request in detail..."
              rows={5}
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Screenshots</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,.pdf"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group">
                    {att.type.startsWith('image/') ? (
                      <img src={att.url} alt={att.name} className="w-20 h-20 object-cover rounded-lg border border-edge" />
                    ) : (
                      <div className="w-20 h-20 bg-surface border border-edge rounded-lg flex items-center justify-center">
                        <Paperclip size={16} className="text-faint" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                    <p className="text-detail text-faint mt-0.5 truncate w-20">{att.name}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || attachments.length >= 5}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted bg-surface border border-edge rounded-lg hover:border-teal/30 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ImageIcon size={13} />
              )}
              {uploading ? 'Uploading...' : attachments.length > 0 ? 'Add more' : 'Attach screenshots'}
            </button>
            <p className="text-detail text-faint mt-1">PNG, JPG, GIF, WebP, or PDF. Max 10MB each, up to 5 files.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              <span className="flex items-center gap-1.5">
                <Video size={13} />
                Loom Recording
                <span className="text-faint font-normal">(optional)</span>
              </span>
            </label>
            <input
              type="url"
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
            <p className="text-detail text-faint mt-1">Paste a Loom share link to help us understand the issue.</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-edge">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            leftIcon={Send}
            loading={saving}
            disabled={!subject.trim()}
            onClick={handleSubmit}
          >
            Submit Ticket
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; icon: typeof CircleDot }> = {
    open: { bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: CircleDot },
    in_progress: { bg: 'bg-sky-50 text-sky-700 border-sky-200', icon: Clock },
    resolved: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    closed: { bg: 'bg-surface text-faint border-edge', icon: AlertCircle },
  };
  const c = config[status] || config.open;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-detail font-semibold border ${c.bg}`}>
      <Icon size={10} />
      {status.replace('_', ' ')}
    </span>
  );
}

function CategoryLabel({ category }: { category: string }) {
  const labels: Record<string, string> = {
    general: 'General',
    billing: 'Billing',
    bug: 'Bug',
    feature_request: 'Feature',
    account: 'Account',
  };
  return (
    <span className="text-detail text-faint">{labels[category] || category}</span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
