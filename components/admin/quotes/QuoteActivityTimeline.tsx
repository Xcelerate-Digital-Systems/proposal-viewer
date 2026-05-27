// components/admin/quotes/QuoteActivityTimeline.tsx
// Vertical timeline of lifecycle events for a quote: created, sent, viewed,
// accepted/declined/revision-requested. Pulled entirely from columns already
// stored on the proposal row plus per-visit rows in proposal_views — no new
// schema. Renders as a collapsible section card so it sits cleanly inside
// the builder without dominating the page.
'use client';

import { useEffect, useState } from 'react';
import {
  Activity, FileText, Send, Eye, CheckCircle2, X, PenLine, ChevronDown, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

interface Props {
  proposal: Proposal;
}

interface Event {
  ts: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  tone: 'neutral' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'revision';
}

const TONE_CLASS: Record<Event['tone'], string> = {
  neutral:  'bg-surface text-muted',
  sent:     'bg-surface text-muted',
  viewed:   'bg-surface text-muted',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-500',
  revision: 'bg-surface text-muted',
};

function formatStamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function buildEvents(p: Proposal, viewCount: number | null): Event[] {
  const events: Event[] = [];

  if (p.created_at) {
    events.push({
      ts: p.created_at,
      icon: FileText,
      label: 'Quote created',
      tone: 'neutral',
    });
  }
  if (p.sent_at) {
    events.push({
      ts: p.sent_at,
      icon: Send,
      label: 'Sent',
      detail: p.client_name ? `to ${p.client_name}` : undefined,
      tone: 'sent',
    });
  }
  if (p.first_viewed_at) {
    events.push({
      ts: p.first_viewed_at,
      icon: Eye,
      label: 'First viewed',
      detail: viewCount && viewCount > 1 ? `${viewCount} views since` : undefined,
      tone: 'viewed',
    });
  }
  if (p.last_viewed_at && p.last_viewed_at !== p.first_viewed_at) {
    events.push({
      ts: p.last_viewed_at,
      icon: Eye,
      label: 'Last viewed',
      tone: 'viewed',
    });
  }
  if (p.accepted_at) {
    events.push({
      ts: p.accepted_at,
      icon: CheckCircle2,
      label: 'Accepted',
      detail: p.accepted_by_name ? `by ${p.accepted_by_name}` : undefined,
      tone: 'accepted',
    });
  }
  if (p.declined_at) {
    events.push({
      ts: p.declined_at,
      icon: X,
      label: 'Declined',
      detail: [
        p.declined_by_name ? `by ${p.declined_by_name}` : null,
        p.decline_reason ? `— "${p.decline_reason}"` : null,
      ].filter(Boolean).join(' ') || undefined,
      tone: 'declined',
    });
  }
  if (p.revision_requested_at) {
    events.push({
      ts: p.revision_requested_at,
      icon: PenLine,
      label: 'Revision requested',
      detail: [
        p.revision_requested_by_name ? `by ${p.revision_requested_by_name}` : null,
        p.revision_notes ? `— "${p.revision_notes}"` : null,
      ].filter(Boolean).join(' ') || undefined,
      tone: 'revision',
    });
  }

  return events.sort((a, b) => b.ts.localeCompare(a.ts));
}

export default function QuoteActivityTimeline({ proposal }: Props) {
  const [open, setOpen] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase
      .from('proposal_views')
      .select('id', { count: 'exact', head: true })
      .eq('proposal_id', proposal.id)
      .then(({ count }) => {
        if (!cancelled) setViewCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [open, proposal.id]);

  const events = buildEvents(proposal, viewCount);
  const latest = events[0];

  return (
    <SectionCard
      title="Activity"
      icon={<Activity size={14} className="text-faint" />}
      action={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-dim hover:text-prose transition-colors"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? 'Collapse' : `${events.length} event${events.length === 1 ? '' : 's'}`}
        </button>
      }
    >
      {!open && latest && (
        <p className="text-xs text-dim">
          Latest: <span className="font-medium text-prose">{latest.label}</span>
          {latest.detail && <span> · {latest.detail}</span>}
          <span className="ml-2 text-faint">{formatStamp(latest.ts)}</span>
        </p>
      )}

      {!open && events.length === 0 && (
        <p className="text-xs text-faint">No activity yet — this quote is still a draft.</p>
      )}

      {open && (
        <ol className="space-y-3">
          {events.length === 0 && (
            <li className="text-xs text-faint">No activity yet — this quote is still a draft.</li>
          )}
          {events.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={`${e.ts}-${i}`} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${TONE_CLASS[e.tone]}`}
                >
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">
                    {e.label}
                    {e.detail && (
                      <span className="text-dim font-normal"> {e.detail}</span>
                    )}
                  </div>
                  <div className="text-detail text-faint mt-0.5">{formatStamp(e.ts)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
