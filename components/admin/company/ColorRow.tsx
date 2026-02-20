// components/admin/company/ColorRow.tsx
'use client';

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

export default function ColorRow({ label, value, onChange, disabled }: ColorRowProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value.slice(0, 7)}
        onChange={(e) => !disabled && onChange(e.target.value)}
        disabled={disabled}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 bg-transparent disabled:cursor-not-allowed shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => !disabled && e.target.value.length <= 9 && onChange(e.target.value)}
        disabled={disabled}
        className="w-24 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}