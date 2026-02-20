// app/templates/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Upload } from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import TemplateUploadModal from '@/components/admin/TemplateUploadModal';
import TemplateCard from '@/components/admin/TemplateCard';

export default function TemplatesPage() {
  return (
    <AdminLayout>
      {(auth) => <TemplatesContent companyId={auth.companyId ?? ''} />}
    </AdminLayout>
  );
}

function TemplatesContent({ companyId }: { companyId: string }) {
  const toast = useToast();
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="px-6 lg:px-10 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)]">
            Templates
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-[#017C87] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
        >
          <Plus size={16} />
          New Template
        </button>
      </div>

      {showUpload && (
        <TemplateUploadModal
          companyId={companyId}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchTemplates(); }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-500 mb-1">No templates yet</h3>
          <p className="text-sm text-gray-400 mb-4">Upload a PDF to create your first template</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 bg-[#017C87] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
          >
            <Upload size={16} />
            Upload Template PDF
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onRefresh={fetchTemplates}
            />
          ))}
        </div>
      )}
    </div>
  );
}