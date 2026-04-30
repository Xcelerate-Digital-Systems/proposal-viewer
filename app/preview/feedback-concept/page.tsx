'use client';

/**
 * Visual concept for a softer, cleaner feedback/comments panel.
 * Static mockup — no data, no wiring. Open at /preview/feedback-concept.
 */

import { useState } from 'react';
import {
  CornerDownRight,
  CheckCircle2,
  MoreHorizontal,
  Send,
  Smile,
  Paperclip,
  MapPin,
  ChevronDown,
} from 'lucide-react';

export default function FeedbackConceptPage() {
  return (
    <div className="min-h-screen bg-[#F5F1EE] flex">
      {/* Fake content backdrop (left) — just a stand-in so the panel sits in context */}
      <div className="flex-1 p-10 hidden md:block">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_8px_24px_rgba(20,20,40,0.04)] aspect-[4/3] relative overflow-hidden">
          {/* Mock pins */}
          <PinMarker n={1} top="22%" left="34%" />
          <PinMarker n={2} top="58%" left="68%" />
          <PinMarker n={3} top="78%" left="22%" tone="resolved" />
          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
            (content preview)
          </div>
        </div>
      </div>

      {/* Comments panel — the actual concept */}
      <CommentsPanel />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comments panel                                                      */
/* ------------------------------------------------------------------ */

function CommentsPanel() {
  return (
    <aside className="w-full md:w-[400px] shrink-0 bg-[#FBF8F5] flex flex-col h-screen">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink tracking-tight">Comments</h2>
          <button className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
            All <ChevronDown size={12} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">3 open · 1 resolved</p>
      </header>

      {/* Threads */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        <Thread
          n={1}
          author="Sarah Lee"
          avatarTone="teal"
          time="2h ago"
          priority={{ label: 'High priority', tone: 'rose' }}
          body="The hero copy feels a bit dense — could we try a single-line headline here? Maybe something punchier for the fold."
          replies={[
            {
              author: 'Jack Burton',
              isTeam: true,
              time: '1h ago',
              body: 'Good call. Drafting two options now.',
            },
          ]}
        />

        <Thread
          n={2}
          author="Marcus Chen"
          avatarTone="amber"
          time="4h ago"
          priority={{ label: 'Medium priority', tone: 'amber' }}
          body="Pricing block looks great. Consider adding a small note about the setup fee being optional."
          replies={[]}
          showReplyForm
        />

        <Thread
          general
          author="Dana Park"
          avatarTone="violet"
          time="Yesterday"
          body="Overall this is looking really clean. A few small things I'll pin shortly."
          replies={[]}
        />

        <ResolvedThread
          n={3}
          author="Sarah Lee"
          time="2 days ago"
          body="Logo on the second slide is a bit small — bumped on review."
        />
      </div>

      {/* Composer */}
      <Composer />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Thread card                                                         */
/* ------------------------------------------------------------------ */

interface ThreadProps {
  n?: number;
  general?: boolean;
  author: string;
  avatarTone: 'teal' | 'amber' | 'violet' | 'rose';
  time: string;
  priority?: { label: string; tone: 'rose' | 'amber' | 'emerald' | 'sky' };
  body: string;
  replies: { author: string; isTeam?: boolean; time: string; body: string }[];
  showReplyForm?: boolean;
}

function Thread({ n, general, author, avatarTone, time, priority, body, replies, showReplyForm }: ThreadProps) {
  return (
    <article className="bg-white rounded-2xl px-5 py-4 shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.03)]">
      {/* Pin tag (top) */}
      {!general && n && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
            {n}
          </span>
          <span className="text-[11px] text-gray-400">Pinned to content</span>
        </div>
      )}

      {/* Author row */}
      <div className="flex items-start gap-3">
        <Avatar tone={avatarTone} initial={author[0]} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink">{author}</span>
            <span className="text-[11px] text-gray-400">{time}</span>
            {priority && <PriorityPill {...priority} />}
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed mt-1">{body}</p>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 ml-11 space-y-3">
          {replies.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <Avatar tone={r.isTeam ? 'teal' : 'violet'} initial={r.author[0]} small />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{r.author}</span>
                  {r.isTeam && (
                    <span className="text-[10px] text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">Team</span>
                  )}
                  <span className="text-[11px] text-gray-400">{r.time}</span>
                </div>
                <p className="text-[13px] text-gray-700 leading-relaxed mt-0.5">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline reply form (only on the second thread) */}
      {showReplyForm && (
        <div className="mt-3 ml-11 flex items-center gap-2 bg-[#F5F1EE] rounded-xl px-3 py-2">
          <input
            placeholder="Write a reply…"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-gray-400 focus:outline-none"
            autoFocus
          />
          <button className="text-gray-400 hover:text-gray-600">
            <Smile size={15} />
          </button>
          <button className="w-7 h-7 rounded-full bg-teal text-white inline-flex items-center justify-center hover:bg-teal-hover">
            <Send size={12} />
          </button>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-4 mt-3 ml-11 text-[12px] text-gray-400">
        <button className="inline-flex items-center gap-1 hover:text-ink transition-colors">
          <CornerDownRight size={12} /> Reply
        </button>
        <button className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <CheckCircle2 size={12} /> Resolve
        </button>
        <button className="ml-auto hover:text-ink transition-colors">
          <MoreHorizontal size={14} />
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Resolved thread (collapsed)                                         */
/* ------------------------------------------------------------------ */

function ResolvedThread({ n, author, time, body }: { n: number; author: string; time: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="bg-white/60 rounded-2xl px-5 py-3.5 border border-dashed border-gray-200">
      <button
        className="w-full flex items-start gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-[11px] font-semibold shrink-0">
          {n}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-gray-500">{author}</span>
            <span className="text-[11px] text-gray-400">· resolved {time}</span>
          </div>
          <p className={`text-[13px] text-gray-500 leading-relaxed mt-0.5 ${open ? '' : 'line-clamp-1'}`}>
            {body}
          </p>
        </div>
      </button>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Composer (footer)                                                   */
/* ------------------------------------------------------------------ */

function Composer() {
  return (
    <div className="px-4 pb-5 pt-3">
      <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.03)] px-4 py-3">
        <textarea
          placeholder="Leave a general comment…"
          rows={2}
          className="w-full text-[13px] text-ink placeholder:text-gray-400 bg-transparent resize-none focus:outline-none leading-relaxed"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-gray-400">
            <button className="p-1.5 rounded-lg hover:bg-gray-50">
              <Paperclip size={14} />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-50">
              <Smile size={14} />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1 text-[11px]">
              <MapPin size={12} /> Pin
            </button>
          </div>
          <button className="w-9 h-9 rounded-full bg-teal text-white inline-flex items-center justify-center hover:bg-teal-hover transition-colors">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function Avatar({ tone, initial, small }: { tone: 'teal' | 'amber' | 'violet' | 'rose'; initial: string; small?: boolean }) {
  const tones: Record<string, string> = {
    teal: 'bg-teal/10 text-teal',
    amber: 'bg-amber-100 text-amber-700',
    violet: 'bg-violet-100 text-violet-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  const size = small ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-[12px]';
  return (
    <div className={`${size} ${tones[tone]} rounded-full inline-flex items-center justify-center font-semibold shrink-0`}>
      {initial}
    </div>
  );
}

function PriorityPill({ label, tone }: { label: string; tone: 'rose' | 'amber' | 'emerald' | 'sky' }) {
  const tones: Record<string, string> = {
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
  };
  return (
    <span className={`text-[11px] ${tones[tone]} px-2 py-0.5 rounded-full font-medium`}>
      {label}
    </span>
  );
}

function PinMarker({ n, top, left, tone = 'open' }: { n: number; top: string; left: string; tone?: 'open' | 'resolved' }) {
  const colors =
    tone === 'resolved'
      ? 'bg-gray-100 text-gray-400 ring-gray-200'
      : 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  return (
    <span
      className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full ring-4 ${colors} text-[11px] font-semibold shadow-sm`}
      style={{ top, left }}
    >
      {n}
    </span>
  );
}
