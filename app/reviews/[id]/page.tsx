// app/reviews/[id]/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /reviews/[id] → /reviews/[id]/items
 *
 * The old monolithic page has been split into:
 *   /reviews/[id]/items  — card grid
 *   /reviews/[id]/board  — whiteboard
 *
 * This redirect keeps any existing links/bookmarks working.
 */
export default function ReviewProjectRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/reviews/${params.id}/items`);
  }, [params.id, router]);

  return null;
}