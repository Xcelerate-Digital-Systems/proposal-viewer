'use client';

import { Plus, Trash2 } from 'lucide-react';
import { inputCls } from './types';

export function AssetListField({ label, items, max, charLimit, onUpdate, onAdd, onRemove, addLabel, multiline }: {
  label: string; items: string[]; max: number; charLimit: number;
  onUpdate: (idx: number, value: string) => void; onAdd: () => void; onRemove: (idx: number) => void; addLabel: string; multiline?: boolean;
}) {
  const filled = items.filter((v) => v.trim()).length;
  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-detail font-medium uppercase tracking-wider text-dim">{label}</span>
        <span className="text-2xs tabular-nums text-faint">{filled}/{max}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((value, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 text-2xs tabular-nums text-faint w-4 text-right">{i + 1}.</span>
            {multiline
              ? <textarea className={`${inputCls} min-h-[52px]`} value={value} onChange={(e) => onUpdate(i, e.target.value)} maxLength={charLimit} />
              : <input className={inputCls} value={value} onChange={(e) => onUpdate(i, e.target.value)} maxLength={charLimit} />}
            {items.length > 1 && (
              <button type="button" onClick={() => onRemove(i)} className="mt-2 p-1 text-faint hover:text-red-500 transition-colors" title="Remove"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      {items.length < max && (
        <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-xs text-teal hover:text-teal-hover font-medium"><Plus size={13} /> {addLabel}</button>
      )}
    </div>
  );
}
