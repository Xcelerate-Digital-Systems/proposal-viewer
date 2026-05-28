// components/ui/Textarea.tsx
// Shared multi-line input primitive — same chrome contract as TextInput.
'use client';

import { forwardRef, useId } from 'react';
import { textareaClasses } from './inputClasses';

export { textareaClasses };

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className = '', rows = 3, id: idProp, ...rest }, ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="block text-xs font-medium text-prose">{label}</label>}
      <textarea ref={ref} id={id} rows={rows} {...rest} className={textareaClasses(className)} />
      {error
        ? <p className="text-detail text-red-500">{error}</p>
        : hint ? <p className="text-detail text-faint">{hint}</p> : null}
    </div>
  );
});

export default Textarea;
