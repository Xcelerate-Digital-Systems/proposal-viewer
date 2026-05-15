'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FunnelRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/funnels/${params.id}/board`);
  }, [params.id, router]);
  return null;
}
