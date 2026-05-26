'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function FunnelRedirect(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/funnels/${params.id}/board`);
  }, [params.id, router]);
  return null;
}
