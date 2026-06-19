'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Smile } from 'lucide-react';

const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

interface EmojiClickPayload {
  emoji: string;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const pickerHeight = 420;
    const pickerWidth = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < pickerHeight
      ? Math.max(8, rect.top - pickerHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(rect.left, window.innerWidth - pickerWidth - 8);
    setPos({ top, left: Math.max(8, left) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
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
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-faint hover:text-prose hover:bg-surface transition-colors"
        title="Add emoji"
      >
        <Smile size={16} />
      </button>

      {open && pos && createPortal(
        <div
          ref={pickerRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50"
        >
          <Picker
            onEmojiClick={handleSelect}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={false}
            width={320}
            height={400}
          />
        </div>,
        document.body
      )}
    </>
  );
}
