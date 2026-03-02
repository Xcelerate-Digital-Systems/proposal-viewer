// app/templates/[id]/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TemplateDetailRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/templates/${params.id}/pages`);
  }, [params.id, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
    </div>
  );
}