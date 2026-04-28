// components/admin/EditorSaveStatusBadge.tsx
'use client';

import { Loader2, Check } from 'lucide-react';
import { useEditorSaveStatus } from './EditorSaveStatusContext';

/**
 * Renders the shared "Saving… / Saved" indicator. Designed to live inside the
 * detail-page header so the user always sees save state in the same spot
 * regardless of which tab they're editing.
 */
export default function EditorSaveStatusBadge() {
  const ctx = useEditorSaveStatus();
  if (!ctx) return null;
  const { status } = ctx;

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 size={12} className="animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-500">
        <Check size={12} />
        Saved
      </span>
    );
  }
  return null;
}
