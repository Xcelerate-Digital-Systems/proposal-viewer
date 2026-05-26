// components/ui/Textarea.tsx
// Shared multi-line input primitive — same chrome contract as TextInput.
'use client';

import { forwardRef } from 'react';
import { textareaClasses } from './inputClasses';

export { textareaClasses };

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className = '', rows = 3, ...rest }, ref,
) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
      <textarea ref={ref} rows={rows} {...rest} className={textareaClasses(className)} />
      {error
        ? <p className="text-[11px] text-red-500">{error}</p>
        : hint ? <p className="text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
});

export default Textarea;
