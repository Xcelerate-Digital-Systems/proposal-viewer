// app/swipe/[token]/page.tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SwipePublicView from './SwipePublicView';
import type { PublicSwipePayload } from '@/lib/types/swipe-files';

async function fetchPayload(token: string): Promise<PublicSwipePayload | null> {
  const h = headers();
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

export default async function SwipeTokenPage({ params }: { params: { token: string } }) {
  const payload = await fetchPayload(params.token);
  if (!payload) notFound();
  return <SwipePublicView payload={payload} />;
}
