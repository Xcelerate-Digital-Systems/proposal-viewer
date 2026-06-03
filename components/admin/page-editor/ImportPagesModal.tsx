// components/admin/page-editor/ImportPagesModal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Check, FileText, DollarSign, Package,
  FolderOpen, List, Loader2, Library, BookOpen, Trash2,
} from 'lucide-react';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { UnifiedPage, PageType } from '@/lib/page-operations';

interface LibraryPage {
  id: string;
  type: PageType;
  title: string;
  label: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ImportPagesModalProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityType: 'template' | 'proposal' | 'document';
  companyId: string;
  onImported: (pages: UnifiedPage[]) => void;
}

const PAGE_TYPE_ICON: Record<PageType, typeof FileText> = {
  pdf:      FileText,
  text:     FileText,
  pricing:  DollarSign,
  packages: Package,
  section:  FolderOpen,
  toc:      List,
};

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  pdf:      'PDF',
  text:     'Text',
  pricing:  'Quote',
  packages: 'Packages',
  section:  'Section',
  toc:      'Contents',
};

type Step = 'pick-template' | 'pick-pages';
type Source = 'templates' | 'library';

export default function ImportPagesModal({
  open,
  onClose,
  entityId,
  entityType,
  companyId,
  onImported,
}: ImportPagesModalProps) {
  const toast = useToast();

  const [source, setSource]                 = useState<Source>('templates');
  const [step, setStep]                     = useState<Step>('pick-template');
  const [templates, setTemplates]           = useState<ProposalTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [pages, setPages]                   = useState<UnifiedPage[]>([]);
  const [loadingPages, setLoadingPages]     = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [importing, setImporting]           = useState(false);
  const [signedUrls, setSignedUrls]         = useState<Record<string, string>>({});
  const [search, setSearch]                 = useState('');

  // Page Library state
  const [libraryPages, setLibraryPages]         = useState<LibraryPage[]>([]);
  const [loadingLibrary, setLoadingLibrary]     = useState(false);
  const [selectedLibIds, setSelectedLibIds]     = useState<Set<string>>(new Set());
  const [librarySignedUrls, setLibrarySignedUrls] = useState<Record<string, string>>({});
  const [savedToLibIds, setSavedToLibIds]       = useState<Set<string>>(new Set());

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSource('templates');
      setStep('pick-template');
      setSelectedTemplate(null);
      setPages([]);
      setSelectedIds(new Set());
      setImporting(false);
      setSignedUrls({});
      setSearch('');
      setLibraryPages([]);
      setSelectedLibIds(new Set());
      setLibrarySignedUrls({});
      setSavedToLibIds(new Set());
    }
  }, [open]);

  // Load templates on mount
  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true })
      .then(({ data }) => {
        // When importing into a template, exclude the target template itself
        const filtered = entityType === 'template'
          ? (data || []).filter((t) => t.id !== entityId)
          : data || [];
        setTemplates(filtered);
        setLoadingTemplates(false);
      });
  }, [open, companyId, entityId, entityType]);

  // Load library pages when source switches to library
  useEffect(() => {
    if (!open || source !== 'library') return;
    setLoadingLibrary(true);
    authedFetch('/api/page-library')
      .then((res) => res.ok ? res.json() : [])
      .then((data: LibraryPage[]) => {
        setLibraryPages(data);
        setLoadingLibrary(false);
        // Signed URLs for PDF library pages
        const pdfs = data.filter((p) => p.type === 'pdf' && p.payload?.file_path);
        if (pdfs.length > 0) {
          Promise.all(
            pdfs.map(async (p) => {
              const fp = p.payload.file_path as string;
              const { data: urlData } = await supabase.storage.from('proposals').createSignedUrl(fp, 600);
              return [p.id, urlData?.signedUrl ?? null] as const;
            }),
          ).then((entries) => {
            const map: Record<string, string> = {};
            for (const [id, url] of entries) { if (url) map[id] = url; }
            setLibrarySignedUrls(map);
          });
        }
      });
  }, [open, source]);

  // Import from library
  const handleLibraryImport = async () => {
    if (selectedLibIds.size === 0) return;
    setImporting(true);
    try {
      const res = await authedFetch('/api/page-library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          library_page_ids: Array.from(selectedLibIds),
          target_entity_id: entityId,
          target_entity_type: entityType,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to import pages');
        setImporting(false);
        return;
      }
      const { pages: imported, imported: count } = await res.json();
      toast.success(`Imported ${count} page${count === 1 ? '' : 's'} from library`);
      onImported(imported);
      onClose();
    } catch {
      toast.error('Failed to import pages');
    } finally {
      setImporting(false);
    }
  };

  // Delete from library
  const handleLibraryDelete = async (id: string) => {
    const res = await authedFetch('/api/page-library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setLibraryPages((prev) => prev.filter((p) => p.id !== id));
      setSelectedLibIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.success('Removed from library');
    }
  };

  // Save a template page to the library
  const handleSaveTemplatePageToLib = async (pageId: string) => {
    try {
      const res = await authedFetch('/api/page-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_page_id: pageId,
          source_entity_type: 'template',
        }),
      });
      if (!res.ok) throw new Error();
      setSavedToLibIds((prev) => new Set(prev).add(pageId));
      toast.success('Saved to page library');
    } catch {
      toast.error('Failed to save to library');
    }
  };

  // Load pages when a template is selected
  const selectTemplate = useCallback(async (t: ProposalTemplate) => {
    setSelectedTemplate(t);
    setStep('pick-pages');
    setLoadingPages(true);
    setSelectedIds(new Set());
    setSignedUrls({});

    const { data } = await supabase
      .from('template_pages_v2')
      .select('*')
      .eq('template_id', t.id)
      .order('position', { ascending: true });

    const rows = (data || []) as unknown as UnifiedPage[];
    setPages(rows);
    setLoadingPages(false);

    // Generate signed URLs for PDF pages
    const pdfPages = rows.filter((p) => p.type === 'pdf' && (p.payload as Record<string, unknown>)?.file_path);
    if (pdfPages.length > 0) {
      const entries = await Promise.all(
        pdfPages.map(async (p) => {
          const filePath = (p.payload as Record<string, unknown>).file_path as string;
          const { data: urlData } = await supabase.storage
            .from('proposals')
            .createSignedUrl(filePath, 600);
          return [p.id, urlData?.signedUrl ?? null] as const;
        }),
      );
      const urlMap: Record<string, string> = {};
      for (const [id, url] of entries) {
        if (url) urlMap[id] = url;
      }
      setSignedUrls(urlMap);
    }
  }, []);

  // Toggle page selection
  const togglePage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(pages.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Import selected pages
  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);

    const apiPath = entityType === 'template'
      ? '/api/templates/pages/import'
      : entityType === 'proposal'
      ? '/api/proposals/pages/import'
      : '/api/documents/pages/import';

    const targetKey = entityType === 'template'
      ? 'target_template_id'
      : entityType === 'proposal'
      ? 'target_proposal_id'
      : 'target_document_id';

    try {
      const res = await authedFetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_page_ids: Array.from(selectedIds),
          [targetKey]: entityId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to import pages');
        setImporting(false);
        return;
      }

      const { pages: imported, imported: count } = await res.json();
      toast.success(`Imported ${count} page${count === 1 ? '' : 's'}`);
      onImported(imported);
      onClose();
    } catch {
      toast.error('Failed to import pages');
    } finally {
      setImporting(false);
    }
  };

  const filteredTemplates = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  const filteredLibrary = search
    ? libraryPages.filter((p) =>
        (p.label || p.title || '').toLowerCase().includes(search.toLowerCase()),
      )
    : libraryPages;

  return (
    <Modal open={open} onClose={onClose} title="Import Pages" size="lg">
      <Modal.Body>
        {/* Source toggle — only show when on the initial step */}
        {(step === 'pick-template' || source === 'library') && (
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface mb-3">
            <button
              onClick={() => { setSource('templates'); setStep('pick-template'); setSearch(''); setSelectedLibIds(new Set()); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                source === 'templates' ? 'bg-white text-ink shadow-sm' : 'text-faint hover:text-dim'
              }`}
            >
              <Library size={12} />
              Templates
            </button>
            <button
              onClick={() => { setSource('library'); setSearch(''); setSelectedIds(new Set()); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                source === 'library' ? 'bg-white text-ink shadow-sm' : 'text-faint hover:text-dim'
              }`}
            >
              <BookOpen size={12} />
              Page Library
            </button>
          </div>
        )}

        {/* ── Page Library source ────────────────────────────────── */}
        {source === 'library' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search library pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />

            {loadingLibrary ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-faint" />
              </div>
            ) : filteredLibrary.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={28} className="mx-auto text-faint mb-2" />
                <p className="text-sm text-faint">
                  {search ? 'No matching pages' : 'Your page library is empty'}
                </p>
                <p className="text-xs text-faint mt-1">
                  Save pages from the page editor to build your library
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedLibIds((prev) =>
                        prev.size === filteredLibrary.length
                          ? new Set()
                          : new Set(filteredLibrary.map((p) => p.id)),
                      )
                    }
                    className="text-xs font-medium text-teal hover:text-teal/80 transition-colors"
                  >
                    {selectedLibIds.size === filteredLibrary.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <span className="text-xs text-faint">
                    {selectedLibIds.size} of {filteredLibrary.length} selected
                  </span>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {filteredLibrary.map((lp) => {
                    const isSelected = selectedLibIds.has(lp.id);
                    const Icon = PAGE_TYPE_ICON[lp.type] || FileText;
                    const thumbUrl = librarySignedUrls[lp.id];

                    return (
                      <div
                        key={lp.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                          isSelected ? 'bg-teal/5 ring-1 ring-teal/30' : 'hover:bg-paper'
                        }`}
                        onClick={() =>
                          setSelectedLibIds((prev) => {
                            const n = new Set(prev);
                            if (n.has(lp.id)) n.delete(lp.id); else n.add(lp.id);
                            return n;
                          })
                        }
                      >
                        <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-teal border-teal' : 'border-edge-hover'
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>

                        {lp.type === 'pdf' && thumbUrl ? (
                          <div className="shrink-0 w-10 h-14 rounded border border-edge overflow-hidden bg-paper">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="shrink-0 w-8 h-8 rounded bg-surface flex items-center justify-center">
                            <Icon size={14} className="text-dim" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-prose truncate">
                            {lp.label || lp.title || 'Untitled'}
                          </p>
                          <p className="text-xs text-faint">
                            {PAGE_TYPE_LABEL[lp.type] || lp.type}
                          </p>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleLibraryDelete(lp.id); }}
                          className="shrink-0 p-1 rounded text-faint hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          style={{ opacity: undefined }}
                          title="Remove from library"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = ''; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Templates source ──────────────────────────────────── */}
        {source === 'templates' && step === 'pick-template' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
              autoFocus
            />

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-faint" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-sm text-faint py-8 text-center">
                {search ? 'No templates match your search.' : 'No other templates found.'}
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-paper transition-colors flex items-center gap-3 group"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                      <Library size={16} className="text-teal" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-prose truncate">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-faint truncate">{t.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-faint opacity-0 group-hover:opacity-100 transition-opacity">
                      Select →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {source === 'templates' && step === 'pick-pages' && (
          <div className="space-y-3">
            {/* Back + template name */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStep('pick-template'); setSearch(''); }}
                className="p-1 rounded hover:bg-surface transition-colors"
              >
                <ArrowLeft size={16} className="text-dim" />
              </button>
              <span className="text-sm font-medium text-prose truncate">
                {selectedTemplate?.name}
              </span>
            </div>

            {loadingPages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-faint" />
              </div>
            ) : pages.length === 0 ? (
              <p className="text-sm text-faint py-8 text-center">
                This template has no pages.
              </p>
            ) : (
              <>
                {/* Select all / none */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectedIds.size === pages.length ? deselectAll : selectAll}
                    className="text-xs font-medium text-teal hover:text-teal/80 transition-colors"
                  >
                    {selectedIds.size === pages.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <span className="text-xs text-faint">
                    {selectedIds.size} of {pages.length} selected
                  </span>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {pages.map((page) => {
                    const isSelected = selectedIds.has(page.id);
                    const Icon = PAGE_TYPE_ICON[page.type] || FileText;
                    const thumbnailUrl = signedUrls[page.id];
                    const alreadySaved = savedToLibIds.has(page.id);

                    return (
                      <div
                        key={page.id}
                        onClick={() => togglePage(page.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-teal/5 ring-1 ring-teal/30'
                            : 'hover:bg-paper'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-teal border-teal'
                            : 'border-edge-hover'
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>

                        {/* Thumbnail or type icon */}
                        {page.type === 'pdf' && thumbnailUrl ? (
                          <div className="shrink-0 w-10 h-14 rounded border border-edge overflow-hidden bg-paper">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="shrink-0 w-8 h-8 rounded bg-surface flex items-center justify-center">
                            <Icon size={14} className="text-dim" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-prose truncate">
                            {page.title || `Page ${page.position + 1}`}
                          </p>
                          <p className="text-xs text-faint">
                            {PAGE_TYPE_LABEL[page.type] || page.type}
                          </p>
                        </div>

                        {/* Save to library */}
                        <button
                          onClick={(e) => { e.stopPropagation(); if (!alreadySaved) handleSaveTemplatePageToLib(page.id); }}
                          disabled={alreadySaved}
                          className={`shrink-0 p-1.5 rounded transition-colors ${
                            alreadySaved
                              ? 'text-emerald-400 cursor-default'
                              : 'text-faint hover:text-teal hover:bg-teal/5'
                          }`}
                          title={alreadySaved ? 'Saved to library' : 'Save to page library'}
                        >
                          {alreadySaved ? <Check size={13} /> : <BookOpen size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={importing}>
          Cancel
        </Button>
        {source === 'templates' && step === 'pick-pages' && (
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importing…
              </>
            ) : (
              <>Import {selectedIds.size > 0 ? `${selectedIds.size} Page${selectedIds.size === 1 ? '' : 's'}` : 'Pages'}</>
            )}
          </Button>
        )}
        {source === 'library' && (
          <Button
            onClick={handleLibraryImport}
            disabled={selectedLibIds.size === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importing…
              </>
            ) : (
              <>Import {selectedLibIds.size > 0 ? `${selectedLibIds.size} Page${selectedLibIds.size === 1 ? '' : 's'}` : 'Pages'}</>
            )}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
