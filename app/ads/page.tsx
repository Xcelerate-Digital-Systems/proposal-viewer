// app/ads/page.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/lib/supabase';
import CreateClientModal from '@/components/admin/ads/CreateClientModal';

type Client = { id: string; name: string };

export default function AdsPage() {
  return (
    <AdminLayout>
      {() => <AdsIndex />}
    </AdminLayout>
  );
}

function AdsIndex() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const didRedirectRef = useRef(false);

  const fetchClients = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setLoading(false); return; }

    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setLoading(false); return; }

    const json = await res.json();
    setClients(Array.isArray(json) ? json : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Auto-redirect to first client ONCE on initial load. Guarded so the effect
  // doesn't re-fire when the list changes (e.g. after creating a new client).
  useEffect(() => {
    if (didRedirectRef.current) return;
    if (!loading && clients.length > 0) {
      didRedirectRef.current = true;
      router.replace(`/ads/client/${clients[0].id}`);
    }
  }, [loading, clients, router]);

  if (loading || clients.length > 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
        <Building2 size={28} className="text-faint" />
      </div>
      <h3 className="text-lg font-semibold text-muted mb-1">No clients yet</h3>
      <p className="text-sm text-faint max-w-sm">
        Create a client to start tracking their ads, decisions, and game plan.
      </p>
      <button
        onClick={() => setShowCreate(true)}
        className="mt-4 inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
      >
        <Plus size={16} />
        New Client
      </button>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={(client) => router.replace(`/ads/client/${client.id}`)}
        />
      )}
    </div>
  );
}
