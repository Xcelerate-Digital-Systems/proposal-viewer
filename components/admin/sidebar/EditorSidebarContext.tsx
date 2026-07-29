// components/admin/sidebar/EditorSidebarContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface EditorSidebarState {
  completion: Record<string, boolean>;
}

interface EditorSidebarContextValue {
  state: EditorSidebarState;
  setCompletion: (completion: Record<string, boolean>) => void;
}

const EditorSidebarContext = createContext<EditorSidebarContextValue>({
  state: { completion: {} },
  setCompletion: () => {},
});

export function EditorSidebarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorSidebarState>({ completion: {} });

  const setCompletion = useCallback((completion: Record<string, boolean>) => {
    setState((prev) => {
      const keys = Object.keys(completion);
      const changed = keys.some((k) => prev.completion[k] !== completion[k]) || keys.length !== Object.keys(prev.completion).length;
      return changed ? { ...prev, completion } : prev;
    });
  }, []);

  return (
    <EditorSidebarContext.Provider value={{ state, setCompletion }}>
      {children}
    </EditorSidebarContext.Provider>
  );
}

export function useEditorSidebar() {
  return useContext(EditorSidebarContext);
}
