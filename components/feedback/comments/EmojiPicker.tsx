'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Smile } from 'lucide-react';

// emoji-picker-react bundles its own data + UI (~150kb). Load it on demand
// so the first paint of the composer stays cheap; ssr:false because the
// picker reaches for window during init.
const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

// emoji-picker-react's onEmojiClick gets a full EmojiClickData object; we
// only need the `emoji` field (the native character). Typed inline to avoid
// pulling the package's types into our public component surface.
interface EmojiClickPayload {
  emoji: string;
}

/**
 * Drop-in emoji picker — categories, search, frequently used, skin tones.
 * Preserves the `onSelect(emoji)` contract so all existing call-sites keep
 * working without changes.
 */
export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const handleSelect = (payload: EmojiClickPayload) => {
    if (payload?.emoji) {
      onSelect(payload.emoji);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-faint hover:text-prose hover:bg-surface transition-colors"
        title="Add emoji"
      >
        <Smile size={16} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50">
          <Picker
            onEmojiClick={handleSelect}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={false}
            width={320}
            height={400}
          />
        </div>
      )}
    </div>
  );
}
