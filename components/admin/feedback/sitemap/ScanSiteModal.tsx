'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Globe, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supabase, type FeedbackItem } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';

interface DiscoveredPage {
  url: string;
  path: string;
  title: string;
}

interface ScanSiteModalProps {
  projectId: string;
  companyId: string;
  userId: string | null;
  rootDomain: string;
  existingItems: FeedbackItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ScanSiteModal({
  projectId, companyId, userId, rootDomain, existingItems,
  onClose, onSuccess,
}: ScanSiteModalProps) {
  const toast = useToast();
  const [scanning, setScanning] = useState(true);
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingPaths = new Set(existingItems.map((i) => i.page_path).filter(Boolean));

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await authFetch(`/api/campaigns/scan-site?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rootDomain }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to scan site');
        setScanning(false);
        return;
      }

      const data = await res.json();
      const discovered: DiscoveredPage[] = data.pages || [];

      // Filter out pages that already exist in the sitemap
      const newPages = discovered.filter((p) => !existingPaths.has(p.path));
      setPages(newPages);
      // Auto-select all new pages
      setSelected(new Set(newPages.map((p) => p.path)));
    } catch {
      setError('Failed to connect to the site. Check the URL and try again.');
    }
    setScanning(false);
  }, [rootDomain, companyId, existingPaths]);

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePage = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pages.map((p) => p.path)));
    }
  };

  const handleImport = async () => {
    const toImport = pages.filter((p) => selected.has(p.path));
    if (toImport.length === 0) return;

    setImporting(true);

    // Build parent/child relationships from path hierarchy
    const sortedByDepth = [...toImport].sort(
      (a, b) => a.path.split('/').length - b.path.split('/').length
    );

    // Identify path prefixes that have multiple children (e.g. /team has /team/x, /team/y)
    // These become auto-created section nodes
    const pathToId = new Map<string, string>();
    // Seed with existing items
    for (const item of existingItems) {
      if (item.page_path) pathToId.set(item.page_path, item.id);
    }
    // Check which existing items are sections so we don't duplicate
    const existingSections = new Set(
      existingItems.filter((i) => i.type === 'section').map((i) => i.page_path).filter(Boolean)
    );

    // Count children per first-level path prefix (only for pages 2+ segments deep)
    const prefixChildren = new Map<string, DiscoveredPage[]>();
    for (const page of sortedByDepth) {
      if (page.path === '/') continue;
      const segments = page.path.split('/').filter(Boolean);
      if (segments.length < 2) continue;
      const prefix = '/' + segments[0];
      // Only auto-section if the prefix itself is NOT a page being imported
      const arr = prefixChildren.get(prefix) ?? [];
      arr.push(page);
      prefixChildren.set(prefix, arr);
    }

    // Create section nodes for prefixes with 2+ children that don't already exist as items
    let orderCounter = existingItems.length;
    const sectionsToCreate: { prefix: string; title: string }[] = [];
    prefixChildren.forEach((children, prefix) => {
      if (children.length < 2) return;
      if (pathToId.has(prefix)) return;
      if (existingSections.has(prefix)) return;
      const title = prefix.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) || prefix;
      sectionsToCreate.push({ prefix, title });
    });

    // Insert section nodes first
    if (sectionsToCreate.length > 0) {
      const sectionRows = sectionsToCreate.map((s, i) => ({
        review_project_id: projectId,
        company_id: companyId,
        type: 'section' as const,
        title: s.title,
        page_path: s.prefix,
        sort_order: orderCounter + i,
        status: 'internal_review' as const,
        created_by: userId,
      }));
      orderCounter += sectionRows.length;

      const { data: insertedSections, error: secErr } = await supabase
        .from('review_items')
        .insert(sectionRows)
        .select('id, page_path');

      if (!secErr && insertedSections) {
        for (const sec of insertedSections) {
          pathToId.set(sec.page_path, sec.id);
        }
      }
    }

    // Insert all page items
    const rows = sortedByDepth.map((page, i) => ({
      review_project_id: projectId,
      company_id: companyId,
      type: 'webpage' as const,
      title: page.title,
      url: page.url,
      page_path: page.path,
      sort_order: orderCounter + i,
      status: 'internal_review' as const,
      created_by: userId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('review_items')
      .insert(rows)
      .select('id, page_path');

    if (insertError || !inserted) {
      toast.error('Failed to import pages');
      setImporting(false);
      return;
    }

    for (const item of inserted) {
      pathToId.set(item.page_path, item.id);
    }

    // Wire up parent relationships based on path nesting
    const updates: { id: string; parent_item_id: string }[] = [];
    for (const item of inserted) {
      if (item.page_path === '/') continue;
      const segments = item.page_path.split('/').filter(Boolean);
      // Walk up the path to find the nearest parent (section or page)
      let found = false;
      for (let i = segments.length - 1; i >= 1; i--) {
        const parentPath = '/' + segments.slice(0, i).join('/');
        const parentId = pathToId.get(parentPath);
        if (parentId) {
          updates.push({ id: item.id, parent_item_id: parentId });
          found = true;
          break;
        }
      }
      if (!found) {
        const rootId = pathToId.get('/');
        if (rootId && item.page_path !== '/') {
          updates.push({ id: item.id, parent_item_id: rootId });
        }
      }
    }

    // Also wire sections under root if they exist
    if (sectionsToCreate.length > 0) {
      const rootId = pathToId.get('/');
      if (rootId) {
        for (const sec of sectionsToCreate) {
          const secId = pathToId.get(sec.prefix);
          if (secId) {
            updates.push({ id: secId, parent_item_id: rootId });
          }
        }
      }
    }

    // Apply parent relationships
    for (const update of updates) {
      await supabase
        .from('review_items')
        .update({ parent_item_id: update.parent_item_id })
        .eq('id', update.id);
    }

    const totalCreated = inserted.length + sectionsToCreate.length;
    const sectionNote = sectionsToCreate.length > 0
      ? ` (${sectionsToCreate.length} section${sectionsToCreate.length !== 1 ? 's' : ''} auto-created)`
      : '';
    toast.success(`Imported ${totalCreated} item${totalCreated !== 1 ? 's' : ''}${sectionNote}`);
    setImporting(false);
    onSuccess();
  };

  const selectedCount = selected.size;

  return (
    <Modal open onClose={onClose} title="Scan Site" size="lg">
      <Modal.Body className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface rounded-xl border border-edge">
          <Globe size={14} className="text-faint shrink-0" />
          <span className="text-sm font-mono text-ink truncate">{rootDomain}</span>
        </div>

        {scanning && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="text-teal animate-spin" />
            <p className="text-sm text-dim">Scanning site for pages...</p>
            <p className="text-xs text-faint">This may take a few seconds</p>
          </div>
        )}

        {error && !scanning && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={22} className="text-amber-500" />
            </div>
            <p className="text-sm text-dim text-center">{error}</p>
            <Button size="sm" variant="outline" onClick={scan}>
              Try Again
            </Button>
          </div>
        )}

        {!scanning && !error && pages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center">
              <Search size={22} className="text-faint" />
            </div>
            <p className="text-sm text-dim">No new pages found</p>
            <p className="text-xs text-faint text-center max-w-[280px]">
              {existingItems.length > 0
                ? 'All discovered pages are already in your sitemap.'
                : 'Could not find any pages on this site. Try adding pages manually.'}
            </p>
          </div>
        )}

        {!scanning && !error && pages.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-dim">
                Found <span className="font-semibold text-ink">{pages.length}</span> page{pages.length !== 1 ? 's' : ''}
                {existingItems.length > 0 && (
                  <span className="text-faint"> (excluding {existingItems.length} already in sitemap)</span>
                )}
              </p>
              <button
                onClick={toggleAll}
                className="text-xs text-teal hover:text-teal-hover transition-colors font-medium"
              >
                {selected.size === pages.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-edge divide-y divide-edge">
              {pages.map((page) => {
                const isSelected = selected.has(page.path);
                return (
                  <button
                    key={page.path}
                    onClick={() => togglePage(page.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-teal/5' : 'hover:bg-surface'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-teal border-teal'
                        : 'border-edge-strong'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{page.title}</p>
                      <p className="text-xs font-mono text-faint truncate">{page.path}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={importing}>
          Cancel
        </Button>
        {!scanning && !error && pages.length > 0 && (
          <Button
            size="sm"
            loading={importing}
            disabled={selectedCount === 0}
            onClick={handleImport}
          >
            Import {selectedCount} Page{selectedCount !== 1 ? 's' : ''}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
