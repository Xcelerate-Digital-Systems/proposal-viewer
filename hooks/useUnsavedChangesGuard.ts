// hooks/useUnsavedChangesGuard.ts
// Warns the user before navigating away when there are unsaved changes.
// Listens to the shared EditorSaveStatusContext — when status is 'saving',
// a beforeunload handler prevents accidental tab close or navigation.
'use client';

import { useEffect } from 'react';
import { useEditorSaveStatus } from '@/components/admin/EditorSaveStatusContext';

export function useUnsavedChangesGuard() {
  const ctx = useEditorSaveStatus();
  const isSaving = ctx?.status === 'saving';

  useEffect(() => {
    if (!isSaving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSaving]);
}
