// components/admin/text-editor/ColorPickerDropdown.tsx
'use client';

import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ColorOption {
  label: string;
  value: string;
}

interface ColorPickerDropdownProps {
  title: string;
  colors: ColorOption[];
  currentColor: string;
  columns?: number;
  showCustomInput?: boolean;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (color: string) => void;
  onClose: () => void;
}

export default function ColorPickerDropdown({
  title,
  colors,
  currentColor,
  columns = 7,
  showCustomInput = false,
  icon,
  isOpen,
  onToggle,
  onSelect,
  onClose,
}: ColorPickerDropdownProps) {
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
        title={title}
        className={`p-2 rounded transition-colors flex items-center gap-0.5 ${
          isOpen
            ? 'bg-[#017C87]/15 text-[#017C87]'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        <div className="relative">
          {icon}
          {currentColor && (
            <div
              className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2" style={{ width: columns === 5 ? 170 : 180 }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider">{title}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5">
              <X size={10} />
            </button>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {colors.map((c) => (
              <button
                key={c.value || 'default'}
                onClick={() => {
                  onSelect(c.value);
                  onClose();
                }}
                title={c.label}
                className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                  currentColor === c.value
                    ? 'ring-2 ring-[#017C87] ring-offset-1'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{
                  backgroundColor: c.value || '#ffffff',
                  ...(c.value === ''
                    ? { background: 'linear-gradient(135deg, #fff 43%, #ef4444 43%, #ef4444 57%, #fff 57%)' }
                    : {}),
                }}
              />
            ))}
          </div>

          {showCustomInput && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
              <input
                type="color"
                value={currentColor || '#000000'}
                onChange={(e) => onSelect(e.target.value)}
                className="w-6 h-6 rounded border border-gray-200 cursor-pointer p-0"
                title="Custom color"
              />
              <span className="text-[10px] text-gray-400">Custom</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
