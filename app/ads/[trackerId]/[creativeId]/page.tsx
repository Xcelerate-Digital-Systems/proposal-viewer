// app/ads/[trackerId]/[creativeId]/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, X, Loader2, Save } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdCreativeForm, { type AdCreativeFormHandle } from '@/components/admin/ads/AdCreativeForm';
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
  const searchParams = useSearchParams();
  const trackerId = params.trackerId as string;
  const creativeId = params.creativeId as string;

  const sortBy = searchParams.get('sort') || 'sort_order';
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'asc';

  const [personas, setPersonas] = useState<string[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<AdCreativeFormHandle>(null);

  const goBack = () => router.push(`/ads/${trackerId}`);

  // Load tracker personas
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

  // Load ordered list of creative IDs for prev/next navigation
  useEffect(() => {
    (async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;
      const qs = new URLSearchParams({
        company_id: companyId,
        tracker_id: trackerId,
        sort_by: sortBy,
        sort_dir: sortDir,
        per_page: '500',
      });
      const res = await fetch(`/api/ads/creatives?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setOrderedIds(json.data.map((c: { id: string }) => c.id));
      }
    })();
  }, [companyId, trackerId, sortBy, sortDir]);

  const currentIdx = orderedIds.indexOf(creativeId);
  const prevId = currentIdx > 0 ? orderedIds[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < orderedIds.length - 1 ? orderedIds[currentIdx + 1] : null;

  const persist = useCallback(async (): Promise<boolean> => {
    const payload = formRef.current?.getPayload();
    if (!payload) return false;

    setSaving(true);
    setError(null);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setError('Not authenticated');
      setSaving(false);
      return false;
    }

    const res = await fetch(`/api/ads/creatives/${creativeId}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error || 'Failed to save');
      return false;
    }
    return true;
  }, [creativeId, companyId]);

  // onSave prop for the form's internal submit — delegates to persist() then goes back on success
  const handleFormSave = useCallback(
    async (_data: Record<string, unknown>): Promise<{ error?: string }> => {
      const ok = await persist();
      if (ok) goBack();
      return ok ? {} : { error: error || 'Failed to save' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, trackerId],
  );

  const handleSaveClick = async () => {
    if (await persist()) goBack();
  };

  const handlePrev = async () => {
    if (!prevId) return;
    if (await persist()) {
      router.push(`/ads/${trackerId}/${prevId}?sort=${sortBy}&dir=${sortDir}`);
    }
  };

  const handleNext = async () => {
    if (!nextId) return;
    if (await persist()) {
      router.push(`/ads/${trackerId}/${nextId}?sort=${sortBy}&dir=${sortDir}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-ivory shadow-[0_1px_0_rgba(20,20,40,0.05)] px-6 lg:px-10 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
            title="Back to ad tracker"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-ink">Edit Creative</h1>

          {/* Prev / Next */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={handlePrev}
              disabled={!prevId || saving}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous ad (saves first)"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-[12px] text-faint tabular-nums min-w-[54px] text-center">
              {currentIdx >= 0 ? `${currentIdx + 1} / ${orderedIds.length}` : '—'}
            </span>
            <button
              onClick={handleNext}
              disabled={!nextId || saving}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next ad (saves first)"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {error && (
            <span className="text-[12px] text-red-600 ml-3 truncate">{error}</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <AdCreativeForm
          ref={formRef}
          trackerId={trackerId}
          companyId={companyId}
          editingId={creativeId}
          personas={personas}
          onClose={goBack}
          onSave={handleFormSave}
          hideFooter
        />
      </div>
    </div>
  );
}
