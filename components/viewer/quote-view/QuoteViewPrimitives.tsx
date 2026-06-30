// components/viewer/quote-view/QuoteViewPrimitives.tsx
// Layout primitive components for the quote single-page view.
// Hoisted out of the main component so they don't get remounted on every
// keystroke. Defining components inline causes React to treat each render as
// a new component type, which destroys the DOM tree inside them and resets
// focus / scroll position.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function Section({ children }: { children: React.ReactNode }) {
  return <section className="px-8 sm:px-14 py-10 print:py-7">{children}</section>;
}

export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return <div style={style}>{children}</div>;
}

export function Hairline({ color }: { color: string }) {
  return (
    <div
      className="mx-8 sm:mx-14 print:mx-0"
      style={{ height: 1, backgroundColor: color }}
    />
  );
}

/* Resolves a Supabase storage path to a short-lived signed URL so the
   recipient can download an attachment without needing a Supabase account. */
export function AttachmentLink({
  path,
  name,
  mime,
  muted,
}: {
  path: string;
  name: string;
  mime: string;
  muted: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 underline decoration-dotted underline-offset-4 hover:no-underline"
      style={{ color: 'inherit' }}
    >
      <span>{name}</span>
      <span className="text-detail uppercase tracking-wider" style={{ color: muted }}>
        {mime.split('/').pop()?.slice(0, 6) ?? 'file'}
      </span>
    </a>
  );
}
