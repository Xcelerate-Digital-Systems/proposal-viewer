// components/ui/ConfirmDialog.tsx
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-edge-strong overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  state.options.destructive ? 'bg-red-50' : 'bg-teal/10'
                }`}>
                  <AlertTriangle size={20} className={
                    state.options.destructive ? 'text-red-500' : 'text-teal'
                  } />
                </div>
                <div>
                  <h3 className="text-ink font-semibold text-base mb-1">
                    {state.options.title || 'Are you sure?'}
                  </h3>
                  <p className="text-sm text-dim leading-relaxed">
                    {state.options.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-edge-strong bg-surface">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                {state.options.cancelLabel || 'Cancel'}
              </Button>
              <Button
                variant={state.options.destructive ? 'danger' : 'primary'}
                size="sm"
                onClick={handleConfirm}
              >
                {state.options.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}