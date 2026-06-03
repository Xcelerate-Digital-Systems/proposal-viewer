'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, ExternalLink, BookmarkPlus, Bookmark } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { FunnelBoard } from '@/components/admin/funnels/board';
import { useFunnelBoardContext } from '@/components/admin/funnels/board/FunnelBoardContext';
import FunnelSettingsMenu from '@/components/admin/funnels/board/FunnelSettingsMenu';
import ScenarioSwitcher from '@/components/admin/funnels/board/ScenarioSwitcher';
import { useToast } from '@/components/ui/Toast';
import { supabase, type Funnel } from '@/lib/supabase';
import { buildFunnelUrl } from '@/lib/proposal-url';
import { duplicateFunnelAsScenario } from '@/lib/funnel/duplicate-funnel';

export default function FunnelBoardPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <BoardGate accountType={auth.accountType} funnelId={params.id} />
      )}
    </AdminLayout>
  );
}

function BoardGate({ accountType, funnelId }: { accountType?: 'agency' | 'client'; funnelId: string }) {
  const router = useRouter();
  const allowed = accountType === 'agency';
  useEffect(() => { if (!allowed) router.replace('/dashboard'); }, [allowed, router]);
  if (!allowed) return null;
  return <BoardContent funnelId={funnelId} />;
}

function BoardContent({ funnelId }: { funnelId: string }) {
  const ctx = useFunnelBoardContext();
  const router = useRouter();
  const toast = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const companyId = ctx?.companyId;
  useEffect(() => {
    if (!companyId) return;
    supabase.from('companies').select('custom_domain, domain_verified').eq('id', companyId).single()
      .then(({ data }) => { if (data?.domain_verified && data.custom_domain) setCustomDomain(data.custom_domain); });
  }, [companyId]);

  if (!ctx) return null;
  const { funnel, loading, setFunnel, companyId: cid, userId } = ctx;

  const saveName = async () => {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!funnel || !next || next === funnel.name) return;
    setFunnel((p) => (p ? { ...p, name: next } : p));
    await supabase.from('funnels').update({ name: next, updated_at: new Date().toISOString() }).eq('id', funnel.id);
  };

  const copyShareLink = async () => {
    if (!funnel) return;
    const url = buildFunnelUrl(funnel.share_token, customDomain, window.location.origin);
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  };

  const saveAsTemplate = async () => {
    if (!funnel) return;
    const created = await duplicateFunnelAsScenario({
      source: funnel,
      companyId: cid,
      userId,
      scenarioName: `${funnel.name} (Template)`,
      asTemplate: true,
    });
    if (!created) { toast.error('Failed to save as template'); return; }
    toast.success('Saved as template — find it in the template gallery');
  };

  if (!funnel && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-4 py-2 border-b border-edge flex items-center gap-2">
        {/* Nav group */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => router.push('/funnels')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors shrink-0"
            title="Back to funnels"
          >
            <ArrowLeft size={14} />
          </button>
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
                className="text-sm font-semibold text-ink bg-white border border-edge rounded-lg px-2 py-1 outline-none focus:border-teal"
              />
            ) : (
              <button
                onClick={() => { setNameDraft(funnel.name); setEditingName(true); }}
                className="text-sm font-semibold text-ink hover:bg-surface px-2 py-1 rounded-lg transition-colors truncate max-w-[280px]"
                title="Rename"
              >
                {funnel.name}
              </button>
            )
          )}
          {funnel && (
            <ScenarioSwitcher funnel={funnel} companyId={cid} userId={userId} />
          )}
        </div>

        {/* Action group */}
        {funnel && (
          <div className="ml-auto flex items-center gap-1">
            <FunnelSettingsMenu
              funnel={funnel}
              onUpdate={async (patch: Partial<Funnel>) => {
                setFunnel((p) => (p ? { ...p, ...patch } : p));
                await supabase
                  .from('funnels')
                  .update({ ...patch, updated_at: new Date().toISOString() })
                  .eq('id', funnel.id);
              }}
            />
            <button
              onClick={saveAsTemplate}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-surface transition-colors"
              title="Save this funnel as a reusable template"
            >
              {funnel.is_template ? <Bookmark size={12} className="text-teal" /> : <BookmarkPlus size={12} />}
              {funnel.is_template ? 'Template' : 'Save as template'}
            </button>
            <div className="w-px h-5 bg-edge mx-0.5" />
            <button
              onClick={copyShareLink}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
              title="Copy share link"
            >
              <Copy size={13} />
            </button>
            <a
              href={`/funnel/${funnel.share_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-white bg-teal hover:bg-teal-hover px-3 py-1.5 rounded-lg transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </a>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <FunnelBoard />
        )}
      </div>
    </div>
  );
}
