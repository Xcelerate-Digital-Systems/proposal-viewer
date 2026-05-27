// components/ui/Select.tsx
// Shared native <select> primitive — same chrome contract as TextInput.
// The native arrow is hidden so we can drop our own ChevronDown indicator and
// keep the visual treatment consistent across the admin.
'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const BASE_CLASSES =
  'w-full pl-3 pr-9 py-2 text-sm border border-edge-strong rounded-lg bg-white text-ink appearance-none ' +
  'focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer';

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className = '', children, ...rest }, ref,
) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-prose">{label}</label>}
      <div className="relative">
        <select ref={ref} {...rest} className={`${BASE_CLASSES} ${className}`}>{children}</select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
        />
      </div>
      {error
        ? <p className="text-detail text-red-500">{error}</p>
        : hint ? <p className="text-detail text-faint">{hint}</p> : null}
    </div>
  );
});

export default Select;
