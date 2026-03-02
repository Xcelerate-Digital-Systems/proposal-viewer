// components/admin/page-editor/OrientationToggle.tsx
'use client';

import { useState } from 'react';

type Orientation = 'auto' | 'portrait' | 'landscape';

interface OrientationToggleProps {
  value: Orientation;
  onChange: (orientation: Orientation) => void;
  variant?: 'default' | 'teal';
}

/**
 * Compact orientation toggle for page editor rows.
 * Cycles through: auto → portrait → landscape → auto
 * Shows a small icon button with a tooltip-style popover.
 */
export default function OrientationToggle({ value, onChange, variant = 'default' }: OrientationToggleProps) {
  const [open, setOpen] = useState(false);

  const isTeal = variant === 'teal';
  const baseColor = isTeal ? '#017C87' : '#6b7280';

  const options: { key: Orientation; label: string; icon: React.ReactNode }[] = [
    {
      key: 'auto',
      label: 'Auto (match PDF)',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M8 5v6M5.5 7.5L8 5l2.5 2.5" />
        </svg>
      ),
    },
    {
      key: 'portrait',
      label: 'Portrait',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="1.5" width="9" height="13" rx="1.5" />
        </svg>
      ),
    },
    {
      key: 'landscape',
      label: 'Landscape',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
        </svg>
      ),
    },
  ];

  const current = options.find((o) => o.key === value) || options[0];

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        title={`Orientation: ${current.label}`}
        className="p-1.5 rounded-md flex items-center justify-center border transition-colors"
        style={{
          color: value === 'auto' ? '#9ca3af' : baseColor,
          borderColor: value === 'auto' ? '#e5e7eb' : `${baseColor}40`,
          backgroundColor: value !== 'auto' ? `${baseColor}08` : 'transparent',
        }}
      >
        {current.icon}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]">
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  value === opt.key
                    ? 'bg-gray-100 font-medium text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span style={{ color: opt.key === 'auto' ? '#9ca3af' : baseColor }}>
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}