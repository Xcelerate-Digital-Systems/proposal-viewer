'use client';

import { useState } from 'react';
import { Globe, Figma } from 'lucide-react';
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

type PageType = 'webpage' | 'figma';

export default function AddSitemapPageModal({
  projectId, companyId, userId, parentItemId, nextSortOrder, items,
  onClose, onSuccess,
}: AddSitemapPageModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [pageType, setPageType] = useState<PageType>('webpage');
  const [title, setTitle] = useState('');
  const [pagePath, setPagePath] = useState('/');
  const [url, setUrl] = useState('');
  const [parentId, setParentId] = useState<string | null>(parentItemId);
  const [saving, setSaving] = useState(false);

  // Figma fields
  const [figmaUrl, setFigmaUrl] = useState('');

  const parentItem = parentId ? items.find((i) => i.id === parentId) : null;
  const rootItems = items.filter((i) => !i.parent_item_id);

  const handleTypeSelect = (type: PageType) => {
    setPageType(type);
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);

    try {
      if (pageType === 'webpage') {
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
        });

        if (error) {
          toast.error('Failed to add page');
          setSaving(false);
          return;
        }
      } else {
        // Figma — parse file key from URL
        const match = figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
        if (!match) {
          toast.error('Invalid Figma URL');
          setSaving(false);
          return;
        }

        const fileKey = match[1];

        const { error } = await supabase.from('review_items').insert({
          review_project_id: projectId,
          company_id: companyId,
          type: 'figma',
          title: title.trim(),
          figma_file_key: fileKey,
          page_path: pagePath.trim() || '/',
          parent_item_id: parentId,
          sort_order: nextSortOrder,
          status: 'internal_review',
          created_by: userId,
        });

        if (error) {
          toast.error('Failed to add page');
          setSaving(false);
          return;
        }
      }

      toast.success('Page added');
      onSuccess();
    } catch {
      toast.error('Something went wrong');
      setSaving(false);
    }
  };

  const modalTitle = step === 'type'
    ? (parentItem ? `Add sub-page under "${parentItem.title}"` : 'Add Page')
    : (pageType === 'webpage' ? 'New Web Page' : 'New Figma Page');

  return (
    <Modal open onClose={onClose} title={modalTitle} size="md">
      {step === 'type' && (
        <Modal.Body className="space-y-2">
          <button
            onClick={() => handleTypeSelect('webpage')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors bg-surface hover:bg-teal/5 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-teal/10">
              <Globe size={20} className="text-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">Web Page</p>
              <p className="text-xs text-faint">Add a URL to review a live or staging page</p>
            </div>
          </button>
          <button
            onClick={() => handleTypeSelect('figma')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors bg-surface hover:bg-teal/5 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-purple-500/10">
              <Figma size={20} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">Figma Design</p>
              <p className="text-xs text-faint">Link a Figma file for design review</p>
            </div>
          </button>
        </Modal.Body>
      )}

      {step === 'details' && (
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
                placeholder={pageType === 'webpage' ? 'e.g. Homepage' : 'e.g. Homepage Design'}
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

            {pageType === 'webpage' && (
              <div>
                <label className="block text-sm font-medium text-prose mb-1.5">
                  Page URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/about"
                  className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
                />
                <p className="text-xs text-faint mt-1">
                  The live or staging URL to embed for review.
                </p>
              </div>
            )}

            {pageType === 'figma' && (
              <div>
                <label className="block text-sm font-medium text-prose mb-1.5">
                  Figma File URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder="https://www.figma.com/design/abc123/..."
                  className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
                />
              </div>
            )}

            {/* Parent page selector */}
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
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep('type')} disabled={saving}>
              Back
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={saving}
              disabled={!title.trim() || (pageType === 'figma' && !figmaUrl.trim())}
            >
              Add Page
            </Button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
}
