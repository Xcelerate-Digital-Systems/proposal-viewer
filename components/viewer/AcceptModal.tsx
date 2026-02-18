'use client';

import { useState } from 'react';
import { CheckCircle2, X, Loader2 } from 'lucide-react';

interface AcceptModalProps {
  title: string;
  onAccept: (name: string) => Promise<void>;
  onClose: () => void;
}

export default function AcceptModal({ title, onAccept, onClose }: AcceptModalProps) {
  const [name, setName] = useState('');
  const [accepting, setAccepting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAccepting(true);
    await onAccept(name);
    setAccepting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-md border border-[#2a2a2a]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)]">
            Accept Proposal
          </h2>
          <button onClick={onClose} className="text-[#666] hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-[#999] mb-4">
            By clicking accept, you acknowledge that you have reviewed the proposal
            &ldquo;<span className="text-white font-medium">{title}</span>&rdquo;
            and agree to proceed with the next steps.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#999] mb-1">Your Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name to accept"
              className="w-full px-3 py-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
            />
          </div>
          <button
            type="submit"
            disabled={accepting || !name.trim()}
            className="w-full bg-[#ff6700] text-white py-3 rounded-lg text-sm font-semibold hover:bg-[#e85d00] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {accepting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {accepting ? 'Processing...' : 'I Accept — Proceed'}
          </button>
          <p className="text-xs text-[#555] mt-3 text-center">
            This action will be timestamped and recorded.
          </p>
        </form>
      </div>
    </div>
  );
}