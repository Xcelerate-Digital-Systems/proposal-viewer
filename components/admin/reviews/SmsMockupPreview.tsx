// components/admin/reviews/SmsMockupPreview.tsx
'use client';

import { useState } from 'react';
import { ChevronLeft, Camera, Phone, Video } from 'lucide-react';

export type SmsClient = 'imessage' | 'android';

interface SmsMockupPreviewProps {
  /** SMS message body */
  body: string;
  /** Sender name / business name */
  senderName?: string;
  /** Which phone style to show */
  client?: SmsClient;
  /** Whether to show client toggle tabs */
  showClientToggle?: boolean;
  /** Callback when client changes */
  onClientChange?: (client: SmsClient) => void;
  /** Brand accent color */
  accentColor?: string;
}

const CLIENT_OPTIONS: { key: SmsClient; label: string }[] = [
  { key: 'imessage', label: 'iMessage' },
  { key: 'android', label: 'Android' },
];

export default function SmsMockupPreview({
  body,
  senderName = 'Your Brand',
  client = 'imessage',
  showClientToggle = false,
  onClientChange,
  accentColor,
}: SmsMockupPreviewProps) {
  const [currentClient, setCurrentClient] = useState<SmsClient>(client);

  const handleClientChange = (c: SmsClient) => {
    setCurrentClient(c);
    onClientChange?.(c);
  };

  return (
    <div className="w-full max-w-[380px]">
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

      {currentClient === 'imessage' && (
        <IMessagePreview body={body} senderName={senderName} />
      )}
      {currentClient === 'android' && (
        <AndroidPreview body={body} senderName={senderName} />
      )}
    </div>
  );
}

/* ================================================================== */
/*  iMessage style                                                     */
/* ================================================================== */

function IMessagePreview({
  body,
  senderName,
}: {
  body: string;
  senderName: string;
}) {
  const initial = senderName.charAt(0).toUpperCase();
  const charCount = body.length;

  return (
    <div className="rounded-[2rem] border border-gray-300 overflow-hidden bg-white shadow-sm">
      {/* Status bar */}
      <div className="px-6 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-900">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`w-[3px] rounded-sm ${i <= 3 ? 'bg-gray-900' : 'bg-gray-300'}`}
                style={{ height: 4 + i * 2 }} />
            ))}
          </div>
          <span className="text-[10px] font-medium text-gray-900 ml-1">5G</span>
          <div className="w-6 h-3 rounded-sm border border-gray-900 ml-1 relative">
            <div className="absolute inset-[1px] right-[3px] bg-gray-900 rounded-[1px]" />
            <div className="absolute right-[-2px] top-[3px] w-[1.5px] h-[4px] bg-gray-900 rounded-r-sm" />
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
        <ChevronLeft size={22} className="text-[#007AFF]" />
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-white mb-1">
            {initial}
          </div>
          <span className="text-xs font-semibold text-gray-900">{senderName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Video size={20} className="text-[#007AFF]" />
          <Phone size={18} className="text-[#007AFF]" />
        </div>
      </div>

      {/* Messages area */}
      <div className="px-4 py-6 min-h-[220px] bg-white flex flex-col justify-end gap-2">
        {/* Timestamp */}
        <p className="text-[10px] text-gray-400 text-center mb-1">Today 9:41 AM</p>

        {/* The SMS bubble */}
        <div className="flex justify-start">
          <div className="max-w-[85%] relative">
            <div className="bg-[#e9e9eb] rounded-2xl rounded-bl-md px-4 py-2.5">
              <p className="text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                {body || 'Your SMS message will appear here…'}
              </p>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 ml-1">
              Delivered
            </p>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
        <Camera size={24} className="text-gray-400 shrink-0" />
        <div className="flex-1 border border-gray-300 rounded-full px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-gray-400">iMessage</span>
        </div>
      </div>

      {/* Character count info */}
      <div className="px-4 pb-3 pt-1">
        <p className="text-[10px] text-center" style={{ color: charCount > 160 ? '#f59e0b' : '#9ca3af' }}>
          {charCount} / 160 characters
          {charCount > 160 && ` · ${Math.ceil(charCount / 160)} segments`}
        </p>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center pb-2">
        <div className="w-28 h-1 bg-gray-900 rounded-full opacity-20" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Android / Google Messages style                                    */
/* ================================================================== */

function AndroidPreview({
  body,
  senderName,
}: {
  body: string;
  senderName: string;
}) {
  const initial = senderName.charAt(0).toUpperCase();
  const charCount = body.length;

  return (
    <div className="rounded-[2rem] border border-gray-300 overflow-hidden bg-white shadow-sm">
      {/* Status bar */}
      <div className="px-6 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-900">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`w-[3px] rounded-sm ${i <= 3 ? 'bg-gray-900' : 'bg-gray-300'}`}
                style={{ height: 4 + i * 2 }} />
            ))}
          </div>
          <span className="text-[10px] font-medium text-gray-900 ml-1">5G</span>
          <div className="w-6 h-3 rounded-sm border border-gray-900 ml-1 relative">
            <div className="absolute inset-[1px] right-[3px] bg-gray-900 rounded-[1px]" />
            <div className="absolute right-[-2px] top-[3px] w-[1.5px] h-[4px] bg-gray-900 rounded-r-sm" />
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-3 border-b border-gray-100">
        <ChevronLeft size={22} className="text-gray-600" />
        <div className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center text-sm font-bold text-white">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900">{senderName}</span>
          <p className="text-[11px] text-gray-500">SMS</p>
        </div>
        <Phone size={18} className="text-gray-600" />
        <Video size={20} className="text-gray-600" />
      </div>

      {/* Messages area */}
      <div className="px-4 py-6 min-h-[220px] bg-[#f8f9fa] flex flex-col justify-end gap-2">
        {/* Timestamp */}
        <p className="text-[10px] text-gray-400 text-center mb-1">Today 9:41 AM</p>

        {/* The SMS bubble */}
        <div className="flex items-end gap-2">
          <div className="w-7 h-7 rounded-full bg-[#1a73e8] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {initial}
          </div>
          <div className="max-w-[80%] relative">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
              <p className="text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                {body || 'Your SMS message will appear here…'}
              </p>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 ml-1">
              9:41 AM
            </p>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-3 py-2.5 border-t border-gray-200 bg-white flex items-center gap-2">
        <div className="flex-1 bg-[#f1f3f4] rounded-full px-4 py-2.5 flex items-center">
          <span className="text-sm text-gray-400">Text message</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#1a73e8] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
      </div>

      {/* Character count info */}
      <div className="px-4 pb-3 pt-1 bg-white">
        <p className="text-[10px] text-center" style={{ color: charCount > 160 ? '#f59e0b' : '#9ca3af' }}>
          {charCount} / 160 characters
          {charCount > 160 && ` · ${Math.ceil(charCount / 160)} segments`}
        </p>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center pb-2 bg-white">
        <div className="w-28 h-1 bg-gray-900 rounded-full opacity-20" />
      </div>
    </div>
  );
}