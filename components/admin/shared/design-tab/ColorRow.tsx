// components/admin/shared/design-tab/ColorRow.tsx
'use client';

import { isValidHex6 } from './DesignTabTypes';

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export default function ColorRow({ label, value, onChange, disabled }: ColorRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <label className="text-xs text-gray-500 whitespace-nowrap">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex6(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: 2 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#000000"
          className="w-[90px] px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#017C87]/30 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}