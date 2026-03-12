// components/reviews/comments/EmojiPicker.tsx
'use client';

import { useState, useRef } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_OPTIONS = [
  '😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥',
  '✅', '❌', '⭐', '🎉', '👀', '💯', '🙏', '❓',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
        title="Add emoji"
      >
        <Smile size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 grid grid-cols-8 gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 w-[200px]">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center text-sm transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
