// app/error.tsx
// Global Next.js error boundary. Catches any uncaught render-time error
// thrown anywhere in the app tree. Without this file Next.js falls back
// to its own minimal "Application error" screen which is jarring and
// reveals no useful context to the user.
//
// This is a route-level fallback, not a substitute for inline <ErrorState>
// on data fetches -- pages should still try/catch their fetches and render
// <ErrorState> when a request fails. This boundary catches the things you
// didn't anticipate (a `.map()` on undefined, a malformed Supabase row, an
// auth context that throws).
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  // Log to the console so the digest + stack are inspectable in production
  // (Next.js strips error messages from the client bundle but keeps digests).
  useEffect(() => {
    console.error('Uncaught route error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={36} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-muted mb-6">
          We hit an unexpected error rendering this page. The team has been notified.
          Try reloading; if it keeps happening, contact support.
        </p>
        {error.digest && (
          <p className="text-2xs font-mono text-faint mb-6">
            Error ref: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
          <Button size="sm" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
