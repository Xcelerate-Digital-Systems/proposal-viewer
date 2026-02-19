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
    const { data } = await supabase
      .from('proposal_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

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
          <h1 className="text-xl font-semibold text-white font-[family-name:var(--font-display)]">
            Templates
          </h1>
          <p className="text-sm text-[#666] mt-0.5">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-[#ff6700] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors"
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
          <div className="w-6 h-6 border-2 border-[#333] border-t-[#ff6700] rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-[#444]" />
          </div>
          <h3 className="text-lg font-semibold text-[#999] mb-1">No templates yet</h3>
          <p className="text-sm text-[#666] mb-4">Upload a PDF to create your first template</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 bg-[#ff6700] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors"
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
              className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5 hover:border-[#333] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white font-[family-name:var(--font-display)]">
                    {t.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-[#666] mt-1">
                    <span>{t.page_count} pages</span>
                    <span className="text-[#333]">&middot;</span>
                    <span>Created {new Date(t.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {t.description && (
                      <>
                        <span className="text-[#333]">&middot;</span>
                        <span className="truncate max-w-xs">{t.description}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                  >
                    <FileText size={14} />
                    Manage Pages
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id, t.name)}
                    className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors"
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