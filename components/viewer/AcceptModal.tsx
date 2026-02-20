// components/viewer/AcceptModal.tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import { deriveBorderColor } from '@/hooks/useProposal';

interface AcceptModalProps {
  title: string;
  onAccept: (name: string) => Promise<void>;
  onClose: () => void;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  acceptTextColor?: string;
  buttonText?: string;
}

export default function AcceptModal({
  title,
  onAccept,
  onClose,
  accentColor = '#ff6700',
  bgColor = '#141414',
  textColor = '#ffffff',
  acceptTextColor = '#ffffff',
  buttonText,
}: AcceptModalProps) {
  const [name, setName] = useState('');
  const [accepting, setAccepting] = useState(false);

  const border = deriveBorderColor(bgColor);
  const label = buttonText || 'Approve & Continue';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAccepting(true);
    await onAccept(name);
    setAccepting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md border"
        style={{ backgroundColor: bgColor, borderColor: border }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: border }}>
          <h2
            className="text-lg font-semibold font-[family-name:var(--font-display)]"
            style={{ color: textColor }}
          >
            {label}
          </h2>
          <button onClick={onClose} style={{ color: textColor, opacity: 0.5 }} className="hover:opacity-100 transition-opacity">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm mb-4" style={{ color: textColor }}>
            By confirming below, you acknowledge that you&rsquo;ve reviewed
            &ldquo;<span className="font-medium">{title}</span>&rdquo;
            and would like to proceed with the next steps.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" style={{ color: textColor }}>
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name to confirm"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{
                backgroundColor: border,
                color: textColor,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: name.trim() ? accentColor : border,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={accepting || !name.trim()}
            className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: accentColor, color: acceptTextColor }}
          >
            {accepting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {accepting ? 'Processing...' : `${label} →`}
          </button>
          <p className="text-xs mt-3 text-center" style={{ color: textColor, opacity: 0.4 }}>
            This will be timestamped and recorded.
          </p>
        </form>
      </div>
    </div>
  );
}