// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText } from 'lucide-react';
import { supabase, Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import UploadModal from '@/components/admin/UploadModal';
import ProposalCard from '@/components/admin/ProposalCard';

export default function AdminDashboard() {
  return (
    <AdminLayout>
      {(auth) => (
        <DashboardContent companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function DashboardContent({ companyId }: { companyId: string }) {
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
    <div className="px-6 lg:px-10 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white font-[family-name:var(--font-display)]">
            Proposals
          </h1>
          <p className="text-sm text-[#666] mt-0.5">
            {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-[#ff6700] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors"
        >
          <Plus size={16} />
          New Proposal
        </button>
      </div>

      {showUpload && (
        <UploadModal
          companyId={companyId}
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
    </div>
  );
}