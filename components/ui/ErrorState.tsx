// components/ui/ErrorState.tsx
// Canonical "something went wrong loading this" UI. Pairs with <EmptyState>
// and the page's loading skeleton -- every list/detail page should be able
// to render one of {loading, error, empty, content} cleanly.
//
// Use this when a fetch fails (network down, supabase RLS rejection,
// server 500, etc.). NOT for not-found cases (use app/not-found.tsx for
// missing entities) or for form-validation errors (those belong inline
// near the field that failed).
'use client';

import { AlertCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  /** Defaults to an AlertCircle icon — pass another LucideIcon for specific
   *  failure modes (WifiOff for network, ShieldOff for auth, etc.) */
  icon?: LucideIcon;
  /** Short headline. Defaults to "Something went wrong". */
  title?: string;
  /** The actual error message, or a friendly version of it. Keep it specific
   *  enough that the user has a chance of acting on it. */
  description?: string;
  /** Wires up a Retry button. Pass the same loader fn the page uses so the
   *  user can re-attempt without a full page refresh. */
  onRetry?: () => void;
  /** Optional second action (e.g. "Go home") below the retry. */
  secondaryAction?: ReactNode;
  className?: string;
}

export default function ErrorState({
  icon: Icon = AlertCircle,
  title = 'Something went wrong',
  description,
  onRetry,
  secondaryAction,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`text-center py-20 ${className}`}>
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon size={28} className="text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted max-w-sm mx-auto">{description}</p>
      )}
      {(onRetry || secondaryAction) && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export { ErrorState };
