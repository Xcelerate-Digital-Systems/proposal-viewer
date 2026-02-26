// components/admin/reviews/EmailMockupPreview.tsx
'use client';

import { useState } from 'react';
import {
  Star,
  Reply,
  Forward,
  MoreHorizontal,
  Trash2,
  Archive,
  Clock,
  ChevronDown,
} from 'lucide-react';

export type EmailClient = 'inbox_preview' | 'email';

interface EmailMockupPreviewProps {
  /** Email subject line */
  subject: string;
  /** Email preheader text */
  preheader: string;
  /** Email body text (supports line breaks) */
  body: string;
  /** Sender name */
  senderName?: string;
  /** Sender email */
  senderEmail?: string;
  /** Which view to show */
  client?: EmailClient;
  /** Whether to show client toggle tabs */
  showClientToggle?: boolean;
  /** Callback when client changes */
  onClientChange?: (client: EmailClient) => void;
  /** Brand accent color */
  accentColor?: string;
  /** Dark mode */
  dark?: boolean;
}

const CLIENT_OPTIONS: { key: EmailClient; label: string }[] = [
  { key: 'inbox_preview', label: 'Inbox' },
  { key: 'email', label: 'Email' },
];

export default function EmailMockupPreview({
  subject,
  preheader,
  body,
  senderName = 'Your Brand',
  senderEmail = 'hello@yourbrand.com',
  client = 'inbox_preview',
  showClientToggle = false,
  onClientChange,
  accentColor,
  dark = false,
}: EmailMockupPreviewProps) {
  const [currentClient, setCurrentClient] = useState<EmailClient>(client);

  const handleClientChange = (c: EmailClient) => {
    setCurrentClient(c);
    onClientChange?.(c);
  };

  return (
    <div className="w-full max-w-[600px]">
      {/* Client toggle */}
      {showClientToggle && (
        <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 max-w-[240px] mx-auto">
          {CLIENT_OPTIONS.map((c) => (
            <button
              key={c.key}
              onClick={() => handleClientChange(c.key)}
              className="flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all"
              style={{
                backgroundColor:
                  currentClient === c.key
                    ? (accentColor || '#017C87')
                    : 'transparent',
                color: currentClient === c.key ? '#ffffff' : '#6b7280',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Email frame */}
      {currentClient === 'inbox_preview' && (
        <InboxPreview
          subject={subject}
          preheader={preheader}
          senderName={senderName}
          dark={dark}
        />
      )}
      {currentClient === 'email' && (
        <EmailOpenPreview
          subject={subject}
          preheader={preheader}
          body={body}
          senderName={senderName}
          senderEmail={senderEmail}
          dark={dark}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Inbox Preview — shows how the email appears in the inbox list      */
/* ================================================================== */

function InboxPreview({
  subject,
  preheader,
  senderName,
  dark,
}: {
  subject: string;
  preheader: string;
  senderName: string;
  dark?: boolean;
}) {
  const bg = dark ? '#1f2937' : '#ffffff';
  const text = dark ? '#f3f4f6' : '#1f2937';
  const textSecondary = dark ? '#9ca3af' : '#6b7280';
  const borderColor = dark ? '#374151' : '#e5e7eb';
  const activeBg = dark ? '#1e3a5f22' : '#eff6ff';

  const initial = senderName.charAt(0).toUpperCase();

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{ backgroundColor: bg, borderColor }}
    >
      {/* Inbox header bar */}
      <div
        className="px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor, backgroundColor: dark ? '#111827' : '#f9fafb' }}
      >
        <span className="text-sm font-semibold" style={{ color: text }}>
          Inbox
        </span>
        <span className="text-xs" style={{ color: textSecondary }}>
          1 new
        </span>
      </div>

      {/* Context rows — older emails (dimmed) */}
      {[
        { from: 'Google', subj: 'Security alert', time: '2d' },
        { from: 'Notion', subj: 'Weekly digest — workspace updates', time: '3d' },
      ].map((row, i) => (
        <div
          key={i}
          className="px-5 py-3.5 border-b flex items-center gap-3"
          style={{ borderColor, opacity: 0.45 }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ backgroundColor: dark ? '#374151' : '#e5e7eb', color: textSecondary }}
          >
            {row.from.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: textSecondary }}>{row.from}</span>
              <span className="text-xs" style={{ color: textSecondary }}>{row.time}</span>
            </div>
            <p className="text-sm truncate" style={{ color: textSecondary }}>{row.subj}</p>
          </div>
        </div>
      ))}

      {/* THE email — highlighted as new/unread */}
      <div
        className="px-5 py-4 border-b flex items-center gap-3 relative"
        style={{ borderColor, backgroundColor: activeBg }}
      >
        {/* Unread indicator */}
        <div
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
          style={{ backgroundColor: '#017C87' }}
        />

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
          style={{ backgroundColor: '#017C87' }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-sm font-bold" style={{ color: text }}>{senderName}</span>
            <span className="text-xs" style={{ color: textSecondary }}>now</span>
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: text }}>
            {subject || 'Subject line'}
          </p>
          <p className="text-sm truncate mt-0.5" style={{ color: textSecondary }}>
            {preheader || 'Preheader text goes here…'}
          </p>
        </div>
        <Star size={16} style={{ color: textSecondary }} className="shrink-0" />
      </div>

      {/* More rows below */}
      {[
        { from: 'Stripe', subj: 'Your January invoice is ready', time: '5d' },
      ].map((row, i) => (
        <div
          key={i}
          className="px-5 py-3.5 flex items-center gap-3"
          style={{ opacity: 0.35 }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ backgroundColor: dark ? '#374151' : '#e5e7eb', color: textSecondary }}
          >
            {row.from.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: textSecondary }}>{row.from}</span>
              <span className="text-xs" style={{ color: textSecondary }}>{row.time}</span>
            </div>
            <p className="text-sm truncate" style={{ color: textSecondary }}>{row.subj}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Email open view — opened email with body                           */
/* ================================================================== */

function EmailOpenPreview({
  subject,
  preheader,
  body,
  senderName,
  senderEmail,
  dark,
}: {
  subject: string;
  preheader: string;
  body: string;
  senderName: string;
  senderEmail: string;
  dark?: boolean;
}) {
  const bg = dark ? '#1f2937' : '#ffffff';
  const text = dark ? '#f3f4f6' : '#1f2937';
  const textSecondary = dark ? '#9ca3af' : '#6b7280';
  const borderColor = dark ? '#374151' : '#e5e7eb';
  const toolbarBg = dark ? '#111827' : '#f9fafb';

  const initial = senderName.charAt(0).toUpperCase();

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{ backgroundColor: bg, borderColor }}
    >
      {/* Toolbar */}
      <div
        className="px-5 py-2.5 border-b flex items-center justify-between"
        style={{ borderColor, backgroundColor: toolbarBg }}
      >
        <div className="flex items-center gap-4">
          <Archive size={16} style={{ color: textSecondary }} />
          <Trash2 size={16} style={{ color: textSecondary }} />
          <Clock size={16} style={{ color: textSecondary }} />
        </div>
        <div className="flex items-center gap-2">
          <MoreHorizontal size={16} style={{ color: textSecondary }} />
        </div>
      </div>

      {/* Subject */}
      <div className="px-6 pt-5 pb-2">
        <h2 className="text-lg font-normal leading-snug" style={{ color: text }}>
          {subject || 'Subject line'}
        </h2>
      </div>

      {/* Sender info */}
      <div className="px-6 py-3.5 flex items-start gap-3.5">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
          style={{ backgroundColor: '#017C87' }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: text }}>{senderName}</span>
            <span className="text-xs" style={{ color: textSecondary }}>
              &lt;{senderEmail}&gt;
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs" style={{ color: textSecondary }}>to me</span>
            <ChevronDown size={10} style={{ color: textSecondary }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs" style={{ color: textSecondary }}>now</span>
          <Star size={16} style={{ color: textSecondary }} className="ml-2" />
          <Reply size={16} style={{ color: textSecondary }} className="ml-1" />
          <MoreHorizontal size={16} style={{ color: textSecondary }} className="ml-1" />
        </div>
      </div>

      {/* Body */}
      <div className="px-6 pb-6 pl-[76px]">
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: text }}
        >
          {body || 'Email body text will appear here…'}
        </div>
      </div>

      {/* Reply / Forward buttons */}
      <div className="px-6 pb-5 pl-[76px] flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border text-sm font-medium"
          style={{ borderColor, color: textSecondary }}
        >
          <Reply size={14} />
          Reply
        </button>
        <button
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border text-sm font-medium"
          style={{ borderColor, color: textSecondary }}
        >
          <Forward size={14} />
          Forward
        </button>
      </div>
    </div>
  );
}