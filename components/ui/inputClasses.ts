// components/ui/inputClasses.ts
// Canonical class strings for text-like form controls (input, textarea).
// Split out from TextInput/Textarea so callers that need a bare <input> or
// <textarea> without the label/hint wrapper (e.g. inline editors, table-row
// edit-in-place, custom layouts) can use the same chrome without copying
// the BASE_CLASSES strings around.

const SHARED =
  'w-full text-sm border border-edge-strong rounded-lg bg-white text-ink placeholder:text-faint ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const inputClasses = (className = '') =>
  `${SHARED} px-3 py-2 ${className}`.trim();

export const textareaClasses = (className = '') =>
  `${SHARED} px-3 py-2 resize-none ${className}`.trim();
