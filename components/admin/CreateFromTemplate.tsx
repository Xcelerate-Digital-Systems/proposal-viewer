// components/admin/CreateFromTemplate.tsx
'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ArrowLeft, Upload, Check, Loader2, RefreshCw } from 'lucide-react';
import { supabase, ProposalTemplate, TemplatePage } from '@/lib/supabase';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CreateFromTemplateProps {
  companyId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function CreateFromTemplate({ companyId, onBack, onSuccess }: CreateFromTemplateProps) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const [replacements, setReplacements] = useState<Record<number, { file: File; url: string }>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');

  // Form
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    supabase
      .from('proposal_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates(data || []);
        setLoading(false);
      });
  }, []);

  const selectTemplate = async (t: ProposalTemplate) => {
    setSelectedTemplate(t);
    setLoadingPages(true);
    setReplacements({});

    const { data } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', t.id)
      .order('page_number', { ascending: true });

    const templatePages = data || [];
    setPages(templatePages);

    const urls: Record<string, string> = {};
    for (const page of templatePages) {
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(page.file_path, 3600);
      if (urlData?.signedUrl) urls[page.id] = urlData.signedUrl;
    }
    setPageUrls(urls);
    setLoadingPages(false);
  };

  const replacePageFile = (pageNumber: number, file: File) => {
    const url = URL.createObjectURL(file);
    setReplacements((prev) => ({ ...prev, [pageNumber]: { file, url } }));
  };

  const undoReplacement = (pageNumber: number) => {
    setReplacements((prev) => {
      const next = { ...prev };
      if (next[pageNumber]) URL.revokeObjectURL(next[pageNumber].url);
      delete next[pageNumber];
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !title.trim() || !clientName.trim()) return;

    setCreating(true);

    try {
      // 1. Upload any replacement pages to temp storage
      setStatus('Uploading custom pages...');
      const replacementPaths: Record<number, string> = {};

      for (const [pageNumStr, { file }] of Object.entries(replacements)) {
        const pageNum = parseInt(pageNumStr);
        const tempPath = `temp/${Date.now()}-replace-${pageNum}.pdf`;
        const { error } = await supabase.storage
          .from('proposals')
          .upload(tempPath, file, { contentType: 'application/pdf' });
        if (error) throw new Error(`Failed to upload replacement for page ${pageNum}`);
        replacementPaths[pageNum] = tempPath;
      }

      // 2. Build the page list with replacements
      const mergePages = pages.map((page) => ({
        file_path: replacementPaths[page.page_number] || page.file_path,
      }));

      // 3. Generate proposal file path and merge
      setStatus('Merging pages...');
      const proposalFilePath = `proposals/${Date.now()}-${title.trim().replace(/\s+/g, '-').toLowerCase()}.pdf`;

      const mergeRes = await fetch('/api/templates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: mergePages, proposal_file_path: proposalFilePath }),
      });

      if (!mergeRes.ok) throw new Error('Failed to merge pages');
      const mergeData = await mergeRes.json();

      // 4. Build page_names from template labels
      const pageNames = pages.map((p) => ({
        name: p.label,
        indent: 0,
      }));

      // 5. Create the proposal record
      setStatus('Creating proposal...');
      const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      const { error: insertError } = await supabase.from('proposals').insert({
        title: title.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        description: description.trim() || null,
        file_path: proposalFilePath,
        file_size_bytes: mergeData.file_size_bytes,
        share_token: shareToken,
        status: 'draft',
        page_names: pageNames,
        company_id: companyId,
      });

      if (insertError) throw new Error('Failed to create proposal');

      // 6. Clean up temp replacement files
      const tempPaths = Object.values(replacementPaths);
      if (tempPaths.length > 0) {
        await supabase.storage.from('proposals').remove(tempPaths);
      }

      setStatus('Done!');
      setTimeout(() => onSuccess(), 300);
    } catch (err) {
      console.error(err);
      setStatus('Something went wrong. Please try again.');
      setCreating(false);
    }
  };

  // Template selection view
  if (!selectedTemplate) {
    return (
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors">
          <ArrowLeft size={14} />
          Back
        </button>
        <h3 className="text-gray-900 font-semibold mb-4">Choose a Template</h3>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No templates yet. Create one from the Templates page first.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="w-full text-left p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-[#017C87]/40 transition-colors"
              >
                <div className="font-medium text-gray-900 text-sm">{t.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t.page_count} pages{t.description ? ` · ${t.description}` : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Template customization + form view
  return (
    <div>
      <button
        onClick={() => setSelectedTemplate(null)}
        className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors"
        disabled={creating}
      >
        <ArrowLeft size={14} />
        Choose different template
      </button>

      <form onSubmit={handleCreate} className="space-y-4">
        {/* Proposal details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proposal Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Website Redesign Proposal"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
            disabled={creating}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="John Smith"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              disabled={creating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 placeholder:text-gray-400"
              disabled={creating}
            />
          </div>
        </div>

        {/* Page list */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pages from &ldquo;{selectedTemplate.name}&rdquo;
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Click &ldquo;Replace&rdquo; on any page to swap it with a custom PDF.
          </p>
          {loadingPages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
              {pages.map((page) => {
                const isReplaced = !!replacements[page.page_number];
                return (
                  <div
                    key={page.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      isReplaced
                        ? 'bg-[#017C87]/10 border border-[#017C87]/20'
                        : 'bg-white border border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{page.page_number}</span>
                      <span className={`truncate ${isReplaced ? 'text-[#017C87]' : 'text-gray-700'}`}>
                        {page.label}
                      </span>
                      {isReplaced && (
                        <span className="text-xs text-[#017C87] bg-[#017C87]/10 px-1.5 py-0.5 rounded shrink-0">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isReplaced ? (
                        <button
                          type="button"
                          onClick={() => undoReplacement(page.page_number)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          disabled={creating}
                        >
                          <RefreshCw size={10} />
                          Undo
                        </button>
                      ) : (
                        <label className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-[#017C87] transition-colors cursor-pointer">
                          <Upload size={10} />
                          Replace
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) replacePageFile(page.page_number, f);
                            }}
                            disabled={creating}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(replacements).length > 0 && (
            <p className="text-xs text-[#017C87] mt-2">
              {Object.keys(replacements).length} page{Object.keys(replacements).length > 1 ? 's' : ''} will be replaced with your custom versions.
            </p>
          )}
        </div>

        {status && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {creating && <Loader2 size={14} className="animate-spin text-[#017C87]" />}
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={creating || !title.trim() || !clientName.trim()}
          className="w-full bg-[#017C87] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating proposal...' : 'Create Proposal'}
        </button>
      </form>
    </div>
  );
}