'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewProjectRedirect(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/campaigns/${params.id}/kanban`);
  }, [params.id, router]);

  return null;
}