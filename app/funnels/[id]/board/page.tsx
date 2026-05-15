'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { FunnelBoard } from '@/components/admin/funnels/board';
import { useFunnelBoardContext } from '@/components/admin/funnels/board/FunnelBoardContext';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

export default function FunnelBoardPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <BoardGate isSuperAdmin={auth.isSuperAdmin} funnelId={params.id} />
      )}
    </AdminLayout>
  );
}

function BoardGate({ isSuperAdmin, funnelId }: { isSuperAdmin?: boolean; funnelId: string }) {
  const router = useRouter();
  useEffect(() => { if (!isSuperAdmin) router.replace('/dashboard'); }, [isSuperAdmin, router]);
  if (!isSuperAdmin) return null;
  return <BoardContent funnelId={funnelId} />;
}

function BoardContent({ funnelId }: { funnelId: string }) {
  const ctx = useFunnelBoardContext();
  const router = useRouter();
  const toast = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  if (!ctx) return null;
  const { funnel, loading, setFunnel } = ctx;

  const saveName = async () => {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!funnel || !next || next === funnel.name) return;
    setFunnel((p) => (p ? { ...p, name: next } : p));
    await supabase.from('funnels').update({ name: next, updated_at: new Date().toISOString() }).eq('id', funnel.id);
  };

  const copyShareLink = async () => {
    if (!funnel) return;
    const url = `${window.location.origin}/funnel/${funnel.share_token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  };

  if (!funnel && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-ivory px-6 py-3 border-b border-edge flex items-center gap-3">
        <button
          onClick={() => router.push('/funnels')}
          className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Funnels
        </button>
        <span className="text-muted/40">/</span>
        {funnel && (
          editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="text-[14px] font-semibold text-ink bg-white border border-edge rounded px-2 py-0.5 outline-none focus:border-teal"
            />
          ) : (
            <button
              onClick={() => { setNameDraft(funnel.name); setEditingName(true); }}
              className="text-[14px] font-semibold text-ink hover:bg-surface px-2 py-0.5 rounded transition-colors"
              title="Rename"
            >
              {funnel.name}
            </button>
          )
        )}

        <div className="ml-auto flex items-center gap-2">
          {funnel && (
            <>
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink px-3 py-1.5 rounded-full hover:bg-surface transition-colors"
              >
                <Copy size={12} />
                Share link
              </button>
              <a
                href={`/funnel/${funnel.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] text-white bg-teal hover:bg-teal-hover px-3 py-1.5 rounded-full transition-colors"
              >
                <ExternalLink size={12} />
                Preview
              </a>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <FunnelBoard />
        )}
      </div>
    </div>
  );
}
