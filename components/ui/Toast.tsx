// components/ui/Toast.tsx
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  action?: ToastAction;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  toast: {
    success: (message: string, opts?: ToastOptions) => void;
    error: (message: string, opts?: ToastOptions) => void;
    info: (message: string, opts?: ToastOptions) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />,
  error: <XCircle size={16} className="text-red-500 shrink-0" />,
  info: <Info size={16} className="text-blue-500 shrink-0" />,
};

const borders: Record<ToastType, string> = {
  success: 'border-emerald-200',
  error: 'border-red-200',
  info: 'border-blue-200',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType, opts?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type, action: opts?.action }]);
    const duration = opts?.action ? 6000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (message: string, opts?: ToastOptions) => addToast(message, 'success', opts),
    error: (message: string, opts?: ToastOptions) => addToast(message, 'error', opts),
    info: (message: string, opts?: ToastOptions) => addToast(message, 'info', opts),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border ${borders[t.type]} shadow-lg shadow-black/10 animate-slide-up min-w-[280px] max-w-[400px]`}
          >
            {icons[t.type]}
            <span className="text-sm text-ink flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { removeToast(t.id); t.action!.onClick(); }}
                className="text-xs font-semibold text-teal hover:text-teal-hover transition-colors shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(t.id)}
              className="text-faint hover:text-dim transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}