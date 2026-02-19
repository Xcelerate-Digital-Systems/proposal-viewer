// components/admin/TemplateDetail.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ArrowLeft, Pencil, Trash2, Plus, Upload, Check, X, Loader2, GripVertical } from 'lucide-react';
import { supabase, ProposalTemplate, TemplatePage } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TemplateDetailProps {
  template: ProposalTemplate;
  onBack: () => void;
  onRefresh: () => void;
}

export default function TemplateDetail({ template, onBack, onRefresh }: TemplateDetailProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');
  const [replacingPage, setReplacingPage] = useState<number | null>(null);
  const [addingAfter, setAddingAfter] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);

  const fetchPages = async () => {
    const { data } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', template.id)
      .order('page_number', { ascending: true });

    const templatePages = data || [];
    setPages(templatePages);

    // Get signed URLs for all pages
    const urls: Record<string, string> = {};
    for (const page of templatePages) {
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(page.file_path, 3600);
      if (urlData?.signedUrl) urls[page.id] = urlData.signedUrl;
    }
    setPageUrls(urls);
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, [template.id]);

  const saveLabel = async (pageId: string) => {
    if (!labelValue.trim()) return;
    await supabase.from('template_pages')
      .update({ label: labelValue.trim() })
      .eq('id', pageId);
    setEditingLabel(null);
    fetchPages();
  };

  const deletePage = async (pageNumber: number) => {
    if (pages.length <= 1) {
      toast.error('Template must have at least one page.');
      return;
    }
    const ok = await confirm({
      title: 'Delete Page',
      message: `Delete page ${pageNumber}? Remaining pages will be renumbered.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setProcessing(true);

    await fetch('/api/templates/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: template.id, page_number: pageNumber }),
    });

    setProcessing(false);
    toast.success('Page deleted');
    onRefresh();
    fetchPages();
  };

  const handleReplacePage = async (pageNumber: number, file: File) => {
    setProcessing(true);
    const formData = new FormData();
    formData.append('template_id', template.id);
    formData.append('page_number', pageNumber.toString());
    formData.append('label', pages.find(p => p.page_number === pageNumber)?.label || `Page ${pageNumber}`);
    formData.append('file', file);

    await fetch('/api/templates/pages', { method: 'POST', body: formData });

    setReplacingPage(null);
    setProcessing(false);
    toast.success(`Page ${pageNumber} replaced`);
    onRefresh();
    fetchPages();
  };

  const handleAddPage = async (afterPageNumber: number, file: File) => {
    setProcessing(true);
    const newPageNumber = afterPageNumber + 1;
    const formData = new FormData();
    formData.append('template_id', template.id);
    formData.append('page_number', newPageNumber.toString());
    formData.append('label', `New Page`);
    formData.append('file', file);

    await fetch('/api/templates/pages', { method: 'POST', body: formData });

    setAddingAfter(null);
    setProcessing(false);
    toast.success('Page inserted');
    onRefresh();
    fetchPages();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[#666] hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            All Templates
          </button>
          <div className="w-px h-5 bg-[#2a2a2a]" />
          <h2 className="text-white font-semibold text-lg font-[family-name:var(--font-display)]">
            {template.name}
          </h2>
          <span className="text-sm text-[#666]">{pages.length} pages</span>
        </div>
      </div>

      {processing && (
        <div className="flex items-center gap-2 text-sm text-[#999] mb-4 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
          <Loader2 size={14} className="animate-spin text-[#ff6700]" />
          Processing changes...
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#333] border-t-[#ff6700] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page, idx) => (
            <div key={page.id}>
              <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden hover:border-[#333] transition-colors">
                <div className="flex items-stretch">
                  {/* PDF Thumbnail */}
                  <div className="w-40 bg-[#0f0f0f] border-r border-[#2a2a2a] flex items-center justify-center shrink-0 p-2">
                    {pageUrls[page.id] ? (
                      <Document file={pageUrls[page.id]} loading={<Loader2 size={16} className="animate-spin text-[#555]" />}>
                        <Page
                          pageNumber={1}
                          width={140}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                      </Document>
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-[#555]" />
                      </div>
                    )}
                  </div>

                  {/* Page info */}
                  <div className="flex-1 p-4 flex items-center justify-between min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[#555] uppercase tracking-wider">
                          Page {page.page_number}
                        </span>
                      </div>
                      {editingLabel === page.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={labelValue}
                            onChange={(e) => setLabelValue(e.target.value)}
                            className="px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm focus:outline-none focus:border-[#ff6700]/50 w-64"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLabel(page.id);
                              if (e.key === 'Escape') setEditingLabel(null);
                            }}
                          />
                          <button onClick={() => saveLabel(page.id)} className="text-emerald-400 hover:text-emerald-300">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingLabel(null)} className="text-[#555] hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingLabel(page.id); setLabelValue(page.label); }}
                          className="text-white font-medium text-sm hover:text-[#ff6700] transition-colors flex items-center gap-1.5 group"
                        >
                          {page.label}
                          <Pencil size={12} className="text-[#555] group-hover:text-[#ff6700]" />
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer">
                        <Upload size={12} />
                        Replace
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleReplacePage(page.page_number, f);
                          }}
                        />
                      </label>
                      <button
                        onClick={() => deletePage(page.page_number)}
                        className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add page after button */}
              <div className="flex items-center justify-center py-1">
                <label className="flex items-center gap-1 px-3 py-1 rounded text-xs text-[#444] hover:text-[#ff6700] hover:bg-[#ff6700]/5 transition-colors cursor-pointer">
                  <Plus size={12} />
                  Insert page after
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAddPage(page.page_number, f);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf" className="hidden" />
      <input ref={addFileRef} type="file" accept=".pdf" className="hidden" />
    </div>
  );
}