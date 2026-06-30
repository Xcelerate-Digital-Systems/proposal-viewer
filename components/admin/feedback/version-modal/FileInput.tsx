'use client';

import { Field } from './Field';

export function FileInput({ file, onChange, accept, optional }: { file: File | null; onChange: (f: File | null) => void; accept: string; optional?: boolean }) {
  return (
    <Field label={optional ? 'New file (optional)' : 'New file'}>
      <div className="flex items-center gap-2">
        <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-caption text-prose file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-edge-strong file:text-xs file:font-medium file:bg-surface hover:file:bg-surface" />
        {file && <span className="text-detail text-dim truncate max-w-[120px]">{file.name}</span>}
      </div>
    </Field>
  );
}
