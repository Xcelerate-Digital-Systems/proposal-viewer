// app/documents/[id]/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DocumentDetailRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/documents/${params.id}/pages`);
  }, [params.id, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
    </div>
  );
}