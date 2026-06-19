// components/ui/ConfirmDialog.tsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
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
        <ConfirmDialogPanel
          options={state.options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialogPanel({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const firstButton = panelRef.current?.querySelector('button');
    firstButton?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      (previousFocus.current as HTMLElement)?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-edge-strong overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              options.destructive ? 'bg-red-50' : 'bg-teal/10'
            }`}>
              <AlertTriangle size={20} className={
                options.destructive ? 'text-red-500' : 'text-teal'
              } aria-hidden="true" />
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-ink font-semibold text-base mb-1">
                {options.title || 'Are you sure?'}
              </h3>
              <p className="text-sm text-dim leading-relaxed">
                {options.message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-edge-strong bg-surface">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {options.cancelLabel || 'Cancel'}
          </Button>
          <Button
            variant={options.destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {options.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}