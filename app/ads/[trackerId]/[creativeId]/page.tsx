// app/ads/[trackerId]/[creativeId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdCreativeForm from '@/components/admin/ads/AdCreativeForm';
import { supabase } from '@/lib/supabase';

export default function EditCreativePage() {
  return (
    <AdminLayout>
      {(auth) => <EditCreative companyId={auth.companyId!} />}
    </AdminLayout>
  );
}

function EditCreative({ companyId }: { companyId: string }) {
  const params = useParams();
  const router = useRouter();
  const trackerId = params.trackerId as string;
  const creativeId = params.creativeId as string;
  const [personas, setPersonas] = useState<string[]>([]);

  const goBack = () => router.push(`/ads/${trackerId}`);

  // Load tracker personas (configured in Standards tab)
  useEffect(() => {
    (async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/ads/trackers/${trackerId}?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data?.standards?.personas) {
        setPersonas(json.data.standards.personas);
      }
    })();
  }, [trackerId, companyId]);

  const handleSave = async (data: Record<string, unknown>) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/creatives/${creativeId}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) return { error: json.error };

    goBack();
    return {};
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-ink">Edit Creative</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto py-6">
        <AdCreativeForm
          trackerId={trackerId}
          companyId={companyId}
          editingId={creativeId}
          personas={personas}
          onClose={goBack}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
