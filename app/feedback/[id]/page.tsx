'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewProjectRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/feedback/${params.id}/board`);
  }, [params.id, router]);

  return null;
}