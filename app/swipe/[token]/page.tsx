// app/swipe/[token]/page.tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import SwipePublicView from './SwipePublicView';
import type { PublicSwipePayload, SwipeFile } from '@/lib/types/swipe-files';

async function fetchPayload(token: string): Promise<PublicSwipePayload | null> {
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  try {
    const res = await fetch(`${base}/api/swipe/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as PublicSwipePayload;
  } catch {
    return null;
  }
}

function truncate(input: string | null | undefined, max = 280): string {
  if (!input) return '';
  const clean = input.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const payload = await fetchPayload(params.token);
  if (!payload || payload.mode !== 'file') {
    return { title: 'Swipe file' };
  }
  const f = payload.file;
  const title = f.title || f.headline || 'Swipe file';
  const descParts = [
    f.brand && `Brand: ${f.brand}`,
    f.headline && `Headline: ${f.headline}`,
    f.primary_text && `Primary text: ${f.primary_text}`,
    f.cta && `CTA: ${f.cta}`,
  ].filter(Boolean) as string[];
  const description = truncate(descParts.join(' · ') || f.description || f.notes || '');
  const image = f.media_type === 'image' ? f.media_url : f.thumbnail_url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * Renders a server-side, machine-readable summary of a swipe file.
 * Visually hidden with sr-only so designers still see the React modal,
 * but fully present in the raw HTML for AI agents, crawlers, and unfurlers.
 */
function SwipeStructuredContent({ file, typeName }: { file: SwipeFile; typeName: string | null }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: file.title,
    headline: file.headline || undefined,
    description: file.primary_text || file.description || file.notes || undefined,
    brand: file.brand || undefined,
    keywords: file.tags?.length ? file.tags.join(', ') : undefined,
    image: file.media_type === 'image' ? file.media_url : file.thumbnail_url || undefined,
    contentUrl: file.media_url || undefined,
    dateCreated: file.created_at,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify does NOT escape `</script>`; without this replace,
        // a swipe file with `title: "</script><script>alert(1)</script>"`
        // would break out and run on every public viewer.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <section className="sr-only" aria-label="Swipe file details">
        <h1>{file.title}</h1>
        {typeName && <p>Type: {typeName}</p>}
        {file.brand && <p>Brand: {file.brand}</p>}
        {file.headline && (
          <p>
            <strong>Headline:</strong> {file.headline}
          </p>
        )}
        {file.primary_text && (
          <p>
            <strong>Primary text:</strong> {file.primary_text}
          </p>
        )}
        {file.description && (
          <p>
            <strong>Description:</strong> {file.description}
          </p>
        )}
        {file.cta && (
          <p>
            <strong>CTA:</strong> {file.cta}
          </p>
        )}
        {file.notes && (
          <p>
            <strong>Notes:</strong> {file.notes}
          </p>
        )}
        {file.tags?.length > 0 && <p>Tags: {file.tags.join(', ')}</p>}
        {file.source_url && (
          <p>
            Source: <a href={file.source_url}>{file.source_url}</a>
          </p>
        )}
        {file.media_url && (
          <p>
            Media ({file.media_type || 'file'}):{' '}
            <a href={file.media_url}>{file.media_url}</a>
          </p>
        )}
      </section>
    </>
  );
}

export default async function SwipeTokenPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const payload = await fetchPayload(params.token);
  if (!payload) notFound();
  return (
    <>
      {payload.mode === 'file' && (
        <SwipeStructuredContent file={payload.file} typeName={payload.type?.name || null} />
      )}
      <SwipePublicView payload={payload} />
    </>
  );
}
