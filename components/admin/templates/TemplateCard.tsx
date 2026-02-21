// components/admin/TemplateCard.tsx
'use client';

import { useState } from 'react';
import {
  FileText, Trash2, Pencil, Image, DollarSign, Copy, Check, Plus,
} from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import TemplatePageManager from './TemplatePageManager';
import TemplatePricingTab from './TemplatePricingTab';
import TemplateCoverEditor from './TemplateCoverEditor';

interface TemplateCardProps {
  template: ProposalTemplate;
  onRefresh: () => void;
  onCreateProposal?: (templateId: string) => void;
}

type ActiveTab = 'pages' | 'pricing' | 'cover' | null;

const formatDate = (date: string | null) => {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const tabDefs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { key: 'pages', label: 'Edit Pages', icon: <Pencil size={14} /> },
  { key: 'pricing', label: 'Pricing', icon: <DollarSign size={14} /> },
  { key: 'cover', label: 'Cover', icon: <Image size={14} /> },
];

export default function TemplateCard({ template: t, onRefresh, onCreateProposal }: TemplateCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);

  const toggleTab = (tab: ActiveTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const deleteTemplate = async () => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete "${t.name}" and all its pages? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    // Clean up page files
    const { data: pages } = await supabase
      .from('template_pages')
      .select('file_path')
      .eq('template_id', t.id);
    if (pages && pages.length > 0) {
      await supabase.storage.from('proposals').remove(pages.map((p) => p.file_path));
    }

    // Clean up cover image
    if (t.cover_image_path) {
      await supabase.storage.from('proposals').remove([t.cover_image_path]);
    }

    await supabase.from('proposal_templates').delete().eq('id', t.id);
    toast.success('Template deleted');
    onRefresh();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-colors hover:border-gray-300">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-semibold font-[family-name:var(--font-display)] truncate text-gray-900">
                {t.name}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                <FileText size={12} /> Template
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{t.page_count} page{t.page_count !== 1 ? 's' : ''}</span>
              <span className="text-gray-200">&middot;</span>
              <span>Created {formatDate(t.created_at)}</span>
              {t.description && (
                <>
                  <span className="text-gray-200">&middot;</span>
                  <span className="truncate max-w-xs">{t.description}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── Tab bar + Actions ──────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-200 -mx-5 px-5">
          {/* Tabs */}
          <div className="flex items-center gap-0">
            {tabDefs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => toggleTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-[#017C87] text-[#017C87]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 pb-1.5">
            {onCreateProposal && (
              <button
                onClick={() => onCreateProposal(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
              >
                <Plus size={13} />
                Create Proposal
              </button>
            )}

            <button
              onClick={deleteTemplate}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete template"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Content ───────────────────────────────────────────── */}
      {activeTab === 'pages' && (
        <TemplatePageManager
          template={t}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'pricing' && (
        <TemplatePricingTab templateId={t.id} />
      )}

      {activeTab === 'cover' && (
        <TemplateCoverEditor
          template={t}
          onSave={() => { setActiveTab(null); onRefresh(); }}
          onCancel={() => setActiveTab(null)}
        />
      )}
    </div>
  );
}