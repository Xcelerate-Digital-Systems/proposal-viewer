// components/ui/TextInput.tsx
// Shared text/number input primitive. Normalises padding, border, focus ring
// and hint chrome across the admin so future restyles are a one-file change.
// Custom className still merges on top so callers can tweak per-instance.
'use client';

import { forwardRef } from 'react';

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  /** Renders a small error message below the input in red. */
  error?: string;
}

const BASE_CLASSES =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, className = '', ...rest }, ref,
) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
      <input ref={ref} {...rest} className={`${BASE_CLASSES} ${className}`} />
      {error
        ? <p className="text-[11px] text-red-500">{error}</p>
        : hint ? <p className="text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
});

export default TextInput;
