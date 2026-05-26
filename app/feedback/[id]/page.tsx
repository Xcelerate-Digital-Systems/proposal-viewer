'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewProjectRedirect(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/feedback/${params.id}/board`);
  }, [params.id, router]);

  return null;
}