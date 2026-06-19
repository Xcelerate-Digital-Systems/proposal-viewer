'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9f8f6' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
              An unexpected error occurred. Try reloading the page.
            </p>
            <button
              onClick={reset}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', background: '#fff' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
