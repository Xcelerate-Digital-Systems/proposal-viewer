// components/admin/EditorSaveStatusContext.tsx
// Shared "Saving… / Saved" indicator state for the detail-page editors
// (Cover, Design, Pricing, Packages, Text, Details, Pages, Contents, etc.).
//
// Each detail layout wraps its tree in <EditorSaveStatusProvider>. The header
// reads via useEditorSaveStatus(); editors push their local autosave state
// up via useReportSaveStatus(localStatus). When an editor is rendered
// outside a provider (e.g. a standalone modal) the hook is a safe no-op,
// so existing usages don't break.
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved';

interface SaveStatusContextValue {
  status: SaveStatus;
  setStatus: (s: SaveStatus) => void;
}

const EditorSaveStatusContext = createContext<SaveStatusContextValue | null>(null);

export function EditorSaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusRaw] = useState<SaveStatus>('idle');

  // Auto-decay: 'saved' → 'idle' after 2s so the badge doesn't linger.
  useEffect(() => {
    if (status !== 'saved') return;
    const t = setTimeout(() => setStatusRaw('idle'), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const setStatus = useCallback((s: SaveStatus) => setStatusRaw(s), []);

  return (
    <EditorSaveStatusContext.Provider value={{ status, setStatus }}>
      {children}
    </EditorSaveStatusContext.Provider>
  );
}

/** Read the current shared save status. Returns null when used outside a provider. */
export function useEditorSaveStatus() {
  return useContext(EditorSaveStatusContext);
}

/**
 * Mirror an editor's local saveStatus up to the shared context. No-op when
 * the editor is rendered outside a provider, so this hook is always safe to call.
 */
export function useReportSaveStatus(status: SaveStatus) {
  const ctx = useContext(EditorSaveStatusContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setStatus(status);
  }, [status, ctx]);
}
