// app/templates/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Trash2, Upload } from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import TemplateUploadModal from '@/components/admin/TemplateUploadModal';
import TemplateDetail from '@/components/admin/TemplateDetail';

export default function TemplatesPage() {
  return (
    <AdminLayout>
      {(auth) => <TemplatesContent companyId={auth.companyId ?? ''} />}
    </AdminLayout>
  );
}

function TemplatesContent({ companyId }: { companyId: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    setSelectedId(null);
    fetchTemplates();
  }, [fetchTemplates]);

  const deleteTemplate = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete "${name}" and all its pages? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const { data: pages } = await supabase
      .from('template_pages')
      .select('file_path')
      .eq('template_id', id);
    if (pages && pages.length > 0) {
      await supabase.storage.from('proposals').remove(pages.map((p) => p.file_path));
    }
    await supabase.from('proposal_templates').delete().eq('id', id);
    if (selectedId === id) setSelectedId(null);
    toast.success('Template deleted');
    fetchTemplates();
  };

  const selectedTemplate = templates.find((t) => t.id === selectedId);

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
      ) : selectedTemplate ? (
        <TemplateDetail
          template={selectedTemplate}
          onBack={() => setSelectedId(null)}
          onRefresh={fetchTemplates}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 shadow-sm transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 font-[family-name:var(--font-display)]">
                    {t.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                    <span>{t.page_count} pages</span>
                    <span className="text-gray-200">&middot;</span>
                    <span>Created {new Date(t.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {t.description && (
                      <>
                        <span className="text-gray-200">&middot;</span>
                        <span className="truncate max-w-xs">{t.description}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    <FileText size={14} />
                    Manage Pages
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id, t.name)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}