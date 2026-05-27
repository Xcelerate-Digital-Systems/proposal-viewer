'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Participant } from '@/lib/feedback/participants';

export interface MentionSuggestionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
  items: Participant[];
  command: (item: Participant) => void;
}

// Keyboard-navigable suggestion dropdown rendered inside a Tippy popover by
// MentionEditor. Mirrors the keyboard contract TipTap's suggestion utility
// expects: parent calls `onKeyDown` via the imperative handle so ArrowUp /
// ArrowDown / Enter / Escape all behave inside the editor input even though
// the dropdown lives in a portal.
const MentionSuggestionList = forwardRef<MentionSuggestionListHandle, Props>(function MentionSuggestionList(
  { items, command },
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const pick = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'Enter') {
        pick(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-edge-strong px-3 py-2 text-xs text-faint min-w-[180px]">
        No matches
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-edge-strong py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => pick(index)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
            index === selectedIndex ? 'bg-teal/10 text-ink' : 'text-prose hover:bg-surface'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-gray-100 text-dim text-2xs flex items-center justify-center font-medium shrink-0">
            {(item.name || item.email).charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{item.name}</span>
            {item.name.toLowerCase() !== item.email.toLowerCase() && (
              <span className="ml-1 text-faint">{item.email}</span>
            )}
          </span>
          <span className={`text-[9px] uppercase tracking-wide ${item.kind === 'team' ? 'text-teal' : 'text-amber-600'}`}>
            {item.kind}
          </span>
        </button>
      ))}
    </div>
  );
});

export default MentionSuggestionList;
