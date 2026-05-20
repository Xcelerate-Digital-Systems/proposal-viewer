// components/ui/Textarea.tsx
// Shared multi-line input primitive — same chrome contract as TextInput.
'use client';

import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const BASE_CLASSES =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 resize-none ' +
  'focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className = '', rows = 3, ...rest }, ref,
) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
      <textarea ref={ref} rows={rows} {...rest} className={`${BASE_CLASSES} ${className}`} />
      {error
        ? <p className="text-[11px] text-red-500">{error}</p>
        : hint ? <p className="text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
});

export default Textarea;
