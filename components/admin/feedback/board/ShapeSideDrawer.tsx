'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { FeedbackBoardShape } from '@/lib/supabase';
import { FUNNEL_COLOR_PRESETS } from '@/lib/types/funnel';

interface Props {
  shape: FeedbackBoardShape;
  onUpdate: (patch: Partial<FeedbackBoardShape>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const SHAPE_TYPE_LABELS: Record<string, string> = {
  rectangle: 'Rectangle', ellipse: 'Ellipse', arrow: 'Arrow', line: 'Line', text: 'Text',
  decision: 'Decision', wait: 'Wait',
  call: 'Call', meeting: 'Meeting', automation: 'Automation', goal: 'Goal',
  button_click: 'Button Click', form_submit: 'Form Submit', video_play: 'Video Play',
  scroll_depth: 'Scroll Depth', purchase: 'Purchase', add_to_cart: 'Add to Cart',
  subscribe: 'Subscribe', custom_event: 'Custom Event',
  sms_notification: 'SMS Notification', email_notification: 'Email Notification',
  ghl_notification: 'HighLevel Notification', google_sheet: 'Google Sheet',
};

const STROKE_WIDTHS = [1, 2, 3, 4, 6];

export default function ShapeSideDrawer({ shape, onUpdate, onDelete, onClose }: Props) {
  const [content, setContent] = useState(shape.content || '');
  useEffect(() => { setContent(shape.content || ''); }, [shape.id]);

  const commitContent = () => {
    const next = content.trim() || null;
    if (next !== (shape.content || null)) onUpdate({ content: next });
  };

  const typeLabel = SHAPE_TYPE_LABELS[shape.shape_type] || 'Shape';
  const isLabelLike = shape.shape_type !== 'text' && shape.shape_type !== 'rectangle' && shape.shape_type !== 'ellipse';

  return (
    <aside className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-2xs font-semibold"
            style={{ backgroundColor: shape.color || '#2B2B2B' }}
          >
            {typeLabel.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-ink truncate">{typeLabel}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <Field label={isLabelLike ? 'Label' : 'Content'}>
          {isLabelLike ? (
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={commitContent}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder={typeLabel}
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={commitContent}
              rows={3}
              placeholder="Type any text…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal resize-y"
            />
          )}
        </Field>

        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Color</h4>
          <div className="flex flex-wrap gap-1.5">
            {FUNNEL_COLOR_PRESETS.map((hex) => {
              const active = shape.color === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onUpdate({ color: hex })}
                  className={`w-6 h-6 rounded-lg border transition-transform ${active ? 'border-ink scale-110' : 'border-edge'}`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              );
            })}
            <input
              type="color"
              value={shape.color || '#2B2B2B'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-6 h-6 rounded-lg border border-edge cursor-pointer"
              title="Custom color"
            />
          </div>
        </div>

        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Stroke</h4>
          <div className="flex items-center gap-1.5">
            {STROKE_WIDTHS.map((w) => {
              const active = shape.stroke_width === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => onUpdate({ stroke_width: w })}
                  className={`h-8 px-2.5 rounded-lg border text-detail flex items-center justify-center transition-colors ${
                    active ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
                  }`}
                  title={`${w}px`}
                >
                  {w}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onUpdate({ dashed: !shape.dashed })}
              className={`ml-auto h-8 px-2.5 rounded-lg border text-detail flex items-center gap-1 transition-colors ${
                shape.dashed ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
              }`}
            >
              Dashed
            </button>
          </div>
        </div>

        {(shape.shape_type === 'text' || shape.shape_type === 'rectangle' || shape.shape_type === 'ellipse') && (
          <Field label="Font size">
            <input
              type="number"
              min={8}
              max={64}
              value={shape.font_size ?? 14}
              onChange={(e) => {
                const n = Number(e.target.value);
                onUpdate({ font_size: Number.isFinite(n) ? n : null });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
            />
          </Field>
        )}
      </div>

      <div className="px-4 py-3 border-t border-edge">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={13} /> Delete {typeLabel.toLowerCase()}
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
