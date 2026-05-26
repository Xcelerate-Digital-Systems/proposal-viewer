// components/ui/TextInput.tsx
// Shared text/number input primitive. Normalises padding, border, focus ring
// and hint chrome across the admin so future restyles are a one-file change.
// For bare inputs without the label/hint wrapper, import `inputClasses` from
// './inputClasses' (works in both server and client components).
'use client';

import { forwardRef } from 'react';
import { inputClasses } from './inputClasses';

// Re-export for callers that already do
// `import { inputClasses } from '@/components/ui/TextInput'`.
export { inputClasses };

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  /** Renders a small error message below the input in red. */
  error?: string;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, className = '', ...rest }, ref,
) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
      <input ref={ref} {...rest} className={inputClasses(className)} />
      {error
        ? <p className="text-[11px] text-red-500">{error}</p>
        : hint ? <p className="text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
});

export default TextInput;
