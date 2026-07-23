'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supabase, type FeedbackItem } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface AddSitemapPageModalProps {
  projectId: string;
  companyId: string;
  userId: string | null;
  parentItemId: string | null;
  nextSortOrder: number;
  items: FeedbackItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSitemapPageModal({
  projectId, companyId, userId, parentItemId, nextSortOrder, items,
  onClose, onSuccess,
}: AddSitemapPageModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [pagePath, setPagePath] = useState('/');
  const [url, setUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [parentId, setParentId] = useState<string | null>(parentItemId);

  const parentItem = parentId ? items.find((i) => i.id === parentId) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);

    try {
      let figmaFileKey: string | null = null;
      if (figmaUrl.trim()) {
        const match = figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
        if (!match) {
          toast.error('Invalid Figma URL');
          setSaving(false);
          return;
        }
        figmaFileKey = match[1];
      }

      const { error } = await supabase.from('review_items').insert({
        review_project_id: projectId,
        company_id: companyId,
        type: 'webpage',
        title: title.trim(),
        url: url.trim() || null,
        page_path: pagePath.trim() || '/',
        parent_item_id: parentId,
        sort_order: nextSortOrder,
        status: 'internal_review',
        created_by: userId,
        figma_file_key: figmaFileKey,
      });

      if (error) {
        toast.error('Failed to add page');
        setSaving(false);
        return;
      }

      toast.success('Page added');
      onSuccess();
    } catch {
      toast.error('Something went wrong');
      setSaving(false);
    }
  };

  const modalTitle = parentItem
    ? `Add sub-page under "${parentItem.title}"`
    : 'Add Page';

  return (
    <Modal open onClose={onClose} title={modalTitle} size="md">
      <form onSubmit={handleSubmit}>
        <Modal.Body className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Page Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Homepage"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Page Path
            </label>
            <div className="flex items-stretch rounded-lg border border-edge-strong focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal overflow-hidden">
              <span className="px-2.5 py-2.5 text-sm font-mono text-faint bg-surface border-r border-edge-strong shrink-0">
                /
              </span>
              <input
                type="text"
                value={pagePath.replace(/^\//, '')}
                onChange={(e) => {
                  const v = e.target.value.replace(/^\/+/, '');
                  setPagePath(v ? `/${v}` : '/');
                }}
                placeholder="about"
                className="flex-1 px-3 py-2.5 text-sm text-ink font-mono placeholder:text-faint focus:outline-none min-w-0"
              />
            </div>
            <p className="text-xs text-faint mt-1">
              The URL path this page represents in the sitemap.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Staging / Live URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://staging.example.com/about"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
            <p className="text-xs text-faint mt-1">
              The live or staging URL to embed for review.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Figma Design URL
            </label>
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/design/abc123/..."
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
            <p className="text-xs text-faint mt-1">
              Link a Figma file for the design of this page.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-prose mb-1.5">
              Parent Page
            </label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            >
              <option value="">None (top-level page)</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.page_path || '/'} — {item.title}
                </option>
              ))}
            </select>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={saving}
            disabled={!title.trim()}
          >
            Add Page
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
