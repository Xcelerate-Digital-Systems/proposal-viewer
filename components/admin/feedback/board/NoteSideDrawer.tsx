'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { FeedbackBoardNote } from '@/lib/supabase';
import { NOTE_COLORS } from './nodes/StickyNoteNode';

interface Props {
  note: FeedbackBoardNote;
  onUpdate: (patch: Partial<FeedbackBoardNote>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function NoteSideDrawer({ note, onUpdate, onDelete, onClose }: Props) {
  const confirm = useConfirm();
  const [content, setContent] = useState(note.content || '');
  useEffect(() => { setContent(note.content || ''); }, [note.id]);

  const commitContent = () => {
    if ((content || '') !== (note.content || '')) onUpdate({ content });
  };

  return (
    <aside className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg shrink-0"
            style={{ backgroundColor: note.color || '#FFF4B8' }}
          />
          <span className="text-xs font-semibold text-ink truncate">Sticky note</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <Field label="Content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={commitContent}
            rows={5}
            placeholder="Type a note…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 resize-y"
          />
        </Field>

        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Color</h4>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_COLORS.map((c) => {
              const active = (note.color || '#FFF4B8') === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onUpdate({ color: c.value })}
                  className={`w-7 h-7 rounded-lg border transition-transform ${active ? 'border-ink scale-110' : 'border-edge'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              );
            })}
          </div>
        </div>

        <Field label="Font size">
          <input
            type="number"
            min={10}
            max={32}
            value={note.font_size ?? 16}
            onChange={(e) => {
              const n = Number(e.target.value);
              onUpdate({ font_size: Number.isFinite(n) ? n : null });
            }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
          />
        </Field>
      </div>

      <div className="px-4 py-3 border-t border-edge">
        <button
          onClick={async () => {
            const ok = await confirm({ message: 'Delete this note?', destructive: true, confirmLabel: 'Delete' });
            if (ok) onDelete();
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={13} /> Delete note
        </button>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}
