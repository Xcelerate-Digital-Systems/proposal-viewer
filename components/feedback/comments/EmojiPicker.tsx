'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Smile } from 'lucide-react';
import data from '@emoji-mart/data';

// emoji-mart's React entry brings a ~150kb Picker into the bundle and only
// needs to hydrate once it's actually opened. Load it on demand so the
// first paint of the composer stays cheap.
const Picker = dynamic(() => import('@emoji-mart/react'), { ssr: false });

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

interface EmojiMartSelection {
  native: string;
}

/**
 * Drop-in emoji picker powered by emoji-mart — categories, search, frequently
 * used, skin tones. Preserves the original `onSelect(emoji)` contract so all
 * existing call-sites keep working without changes.
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

  const handleSelect = (emoji: EmojiMartSelection) => {
    if (emoji?.native) {
      onSelect(emoji.native);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        title="Add emoji"
      >
        <Smile size={16} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50">
          <Picker
            data={data}
            onEmojiSelect={handleSelect}
            theme="light"
            previewPosition="none"
            skinTonePosition="search"
            perLine={8}
            maxFrequentRows={1}
            dynamicWidth={false}
          />
        </div>
      )}
    </div>
  );
}
