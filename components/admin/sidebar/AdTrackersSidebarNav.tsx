// components/admin/sidebar/AdTrackersSidebarNav.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Building2, ChevronRight, Rocket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CreateClientModal from '@/components/admin/ads/CreateClientModal';

type ClientRow = {
  id: string;
  name: string;
  slug: string | null;
  logo_url?: string | null;
};

export default function AdTrackersSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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

  // Active client derived from URL: /ads/client/[clientId]
  const currentClientId = pathname?.startsWith('/ads/client/')
    ? pathname.split('/')[3] || null
    : null;

  const inAndromeda = pathname?.startsWith('/ads/naming-convention') ?? false;

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[#013036] transition-colors mb-1"
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </Link>

      <div className="px-3 pt-1 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Ad Tracker
        </span>
      </div>

      <div className="space-y-0.5">
        {loading ? (
          <p className="text-xs text-white/40 px-3 py-2">Loading…</p>
        ) : clients.length === 0 ? (
          <p className="text-xs text-white/40 px-3 py-2">No clients yet</p>
        ) : (
          clients.map((client) => {
            const active = client.id === currentClientId;
            return (
              <Link
                key={client.id}
                href={`/ads/client/${client.id}`}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-[#013036]'
                }`}
              >
                <Building2
                  size={15}
                  className={active ? 'text-[#8AD9D1] shrink-0' : 'text-white/40 shrink-0'}
                />
                <span className="flex-1 truncate">{client.name}</span>
                {active && <ChevronRight size={12} className="text-[#8AD9D1]/50 shrink-0" />}
              </Link>
            );
          })
        )}

        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#8AD9D1] hover:bg-[#013036] transition-colors mt-1"
        >
          <Plus size={15} />
          New Client
        </button>
      </div>

      <div className="mt-4 mb-2 mx-3 border-t border-[#01434A]" />
      <div className="px-3 pt-1 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Reference
        </span>
      </div>
      <div className="space-y-0.5">
        <Link
          href="/ads/naming-convention"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            inAndromeda ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-[#013036]'
          }`}
        >
          <Rocket
            size={15}
            className={inAndromeda ? 'text-[#8AD9D1] shrink-0' : 'text-white/40 shrink-0'}
          />
          <span className="flex-1 truncate">Andromeda</span>
        </Link>
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={async (client) => {
            await fetchClients();
            setShowCreate(false);
            router.push(`/ads/client/${client.id}`);
          }}
        />
      )}
    </>
  );
}
