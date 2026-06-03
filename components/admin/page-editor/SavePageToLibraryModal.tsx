'use client';

import { useState } from 'react';
import { Loader2, Library, FileText, DollarSign, Package, FolderOpen, List } from 'lucide-react';
import { authedFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { PageType } from '@/lib/page-operations';

interface Props {
  open: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
  pageType: PageType;
  entityType: 'proposal' | 'template' | 'document';
}

const PAGE_TYPE_ICON: Record<PageType, typeof FileText> = {
  pdf: FileText, text: FileText, pricing: DollarSign,
  packages: Package, section: FolderOpen, toc: List,
};

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  pdf: 'PDF', text: 'Text', pricing: 'Quote',
  packages: 'Packages', section: 'Section', toc: 'Contents',
};

export default function SavePageToLibraryModal({
  open, onClose, pageId, pageTitle, pageType, entityType,
}: Props) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authedFetch('/api/page-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_page_id: pageId,
          source_entity_type: entityType,
          label: label.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
      toast.success('Page saved to library');
      setLabel('');
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const Icon = PAGE_TYPE_ICON[pageType] || FileText;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-[380px]">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Library size={16} className="text-teal" />
            <h3 className="text-sm font-semibold text-ink">Save to Page Library</h3>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-surface border border-edge-strong mb-4">
            <Icon size={13} className="text-teal/60 shrink-0" />
            <span className="text-xs text-faint">{PAGE_TYPE_LABEL[pageType]}</span>
            <span className="text-xs text-faint mx-0.5">&middot;</span>
            <span className="text-sm text-ink truncate">{pageTitle || 'Untitled'}</span>
          </div>

          <label className="block text-xs font-medium text-dim mb-1.5">
            Label <span className="text-faint font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Standard T&C page, Hero intro…"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className="w-full px-3 py-2 rounded-lg border border-edge-strong bg-white text-sm text-ink placeholder:text-faint focus:outline-none focus:border-teal/40"
          />
          <p className="text-2xs text-faint mt-1">
            A short name to help you find this page later. Uses the page title if left blank.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-edge-strong flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-dim hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Library size={12} />}
            Save to Library
          </Button>
        </div>
      </div>
    </Modal>
  );
}
