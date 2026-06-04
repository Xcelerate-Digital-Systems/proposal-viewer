'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareText, ArrowLeft, Send, Building2, Clock, AlertCircle,
  CheckCircle2, Loader2, CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

type Ticket = {
  id: string;
  ticket_number: number;
  company_id: string;
  created_by_name: string;
  created_by_email: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  companies: { name: string } | null;
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

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

export default function SupportTab() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = statusFilter === 'all'
        ? '/api/admin/support'
        : `/api/admin/support?status=${statusFilter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setTickets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { setLoading(true); fetchTickets(); }, [fetchTickets]);

  if (selectedId) {
    return (
      <TicketDetailView
        ticketId={selectedId}
        onBack={() => { setSelectedId(null); fetchTickets(); }}
      />
    );
  }

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f.key
                ? 'bg-teal text-white'
                : 'bg-surface text-muted border border-edge hover:border-teal/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={20} className="animate-spin text-faint" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquareText size={28} className="text-faint mx-auto mb-3" />
          <h3 className="text-base font-semibold text-muted mb-1">No tickets</h3>
          <p className="text-sm text-faint">
            {statusFilter === 'all'
              ? 'No support tickets have been submitted yet.'
              : `No ${statusFilter.replace('_', ' ')} tickets.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedId(ticket.id)}
              className="w-full text-left bg-white border border-edge rounded-xl p-4 hover:border-teal/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-faint font-mono">#{ticket.ticket_number}</span>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <CategoryBadge category={ticket.category} />
                  </div>
                  <h4 className="text-sm font-medium text-ink truncate">{ticket.subject}</h4>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-faint">
                    <span className="flex items-center gap-1">
                      <Building2 size={11} />
                      {ticket.companies?.name || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {timeAgo(ticket.created_at)}
                    </span>
                    <span>{ticket.created_by_name}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketDetailView({
  ticketId,
  onBack,
}: {
  ticketId: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setTicket(await res.json());
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const handleStatusChange = async (status: string) => {
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Ticket marked as ${status.replace('_', ' ')}`);
        fetchTicket();
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/admin/support/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (res.ok) {
        setReply('');
        fetchTicket();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to send reply');
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors mb-2"
          >
            <ArrowLeft size={13} />
            Back to tickets
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-faint font-mono">#{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h2 className="text-lg font-semibold text-ink">{ticket.subject}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-faint">
            <span className="flex items-center gap-1">
              <Building2 size={11} />
              {ticket.companies?.name}
            </span>
            <span>{ticket.created_by_name} ({ticket.created_by_email})</span>
            <span>{timeAgo(ticket.created_at)}</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {ticket.status !== 'resolved' && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={CheckCircle2}
              loading={updating}
              onClick={() => handleStatusChange('resolved')}
            >
              Resolve
            </Button>
          )}
          {ticket.status === 'resolved' && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={CircleDot}
              loading={updating}
              onClick={() => handleStatusChange('open')}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="bg-surface border border-edge rounded-xl p-4 mb-6">
          <div className="text-xs font-medium text-faint mb-2">Description</div>
          <p className="text-sm text-ink whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* Messages */}
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
                  Admin
                </span>
              )}
              <span className="text-xs text-faint">{timeAgo(msg.created_at)}</span>
            </div>
            <p className="text-sm text-ink whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}

        {ticket.support_ticket_messages.length === 0 && (
          <p className="text-sm text-faint text-center py-4">No messages yet.</p>
        )}
      </div>

      {/* Reply form */}
      {ticket.status !== 'closed' && (
        <div className="bg-white border border-edge rounded-xl p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply..."
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
              Send Reply
            </Button>
          </div>
        </div>
      )}
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

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'normal') return null;
  const colors: Record<string, string> = {
    low: 'text-faint',
    high: 'text-orange-600',
    urgent: 'text-red-600',
  };
  return (
    <span className={`text-detail font-semibold uppercase ${colors[priority] || ''}`}>
      {priority}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const labels: Record<string, string> = {
    general: 'General',
    billing: 'Billing',
    bug: 'Bug',
    feature_request: 'Feature',
    account: 'Account',
  };
  return (
    <span className="text-detail text-faint bg-surface px-1.5 py-0.5 rounded border border-edge">
      {labels[category] || category}
    </span>
  );
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
