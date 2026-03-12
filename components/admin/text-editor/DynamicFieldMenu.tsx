// components/admin/text-editor/DynamicFieldMenu.tsx
'use client';

import { useRef, useEffect } from 'react';
import { Code2, ChevronDown } from 'lucide-react';
import { DYNAMIC_FIELDS } from './DynamicFieldExtension';

interface DynamicFieldMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onInsert: (field: string) => void;
}

export default function DynamicFieldMenu({ isOpen, onToggle, onClose, onInsert }: DynamicFieldMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
          isOpen
            ? 'bg-teal/15 text-teal'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
        title="Insert Dynamic Field"
      >
        <Code2 size={15} />
        <span>Fields</span>
        <ChevronDown size={13} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-gray-400 tracking-wider">
            Insert Dynamic Field
          </div>
          {DYNAMIC_FIELDS.map((f) => (
            <button
              key={f.field}
              onClick={() => onInsert(f.field)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-sm text-gray-700">{f.label}</span>
                <p className="text-[10px] text-gray-400">{f.description}</p>
              </div>
              <span className="text-[10px] text-teal font-mono bg-teal/5 px-1.5 py-0.5 rounded">
                {'{' + f.field + '}'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
