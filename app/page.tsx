// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Settings, LogOut, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';
import { supabase, Proposal } from '@/lib/supabase';
import AuthGuard from '@/components/auth/AuthGuard';
import UploadModal from '@/components/admin/UploadModal';
import ProposalCard from '@/components/admin/ProposalCard';

export default function AdminDashboard() {
  return (
    <AuthGuard>
      {(auth) => <DashboardContent signOut={auth.signOut} memberName={auth.teamMember?.name} />}
    </AuthGuard>
  );
}

function DashboardContent({ signOut, memberName }: { signOut: () => Promise<void>; memberName?: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchProposals = useCallback(async () => {
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });
    setProposals(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <header className="border-b border-[#2a2a2a] bg-[#0f0f0f]/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-8" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-[#ff6700] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors"
            >
              <Plus size={16} />
              New Proposal
            </button>
            <Link
              href="/templates"
              className="p-2.5 text-[#666] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Templates"
            >
              <LayoutTemplate size={18} />
            </Link>
            <Link
              href="/settings"
              className="p-2.5 text-[#666] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={18} />
            </Link>
            <button
              onClick={signOut}
              className="p-2.5 text-[#666] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title={memberName ? `Sign out (${memberName})` : 'Sign out'}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onSuccess={fetchProposals}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#333] border-t-[#ff6700] rounded-full animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-[#444]" />
            </div>
            <h3 className="text-lg font-semibold text-[#999] mb-1">No proposals yet</h3>
            <p className="text-sm text-[#666]">Upload your first proposal to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onRefresh={fetchProposals} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}