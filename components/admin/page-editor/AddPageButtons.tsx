// components/admin/page-editor/AddPageButtons.tsx
'use client';

import {
  DollarSign, Package, FileText, FolderOpen, List,
} from 'lucide-react';

interface AddPageButtonsProps {
  isDocuments: boolean;
  canAddPricing: boolean;
  canAddToc: boolean;
  onAddPricing: () => void;
  onAddPackages: () => void;
  onAddText: () => void;
  onAddSection: () => void;
  onAddToc: () => void;
}

const btnClass =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal border border-dashed border-teal/30 hover:bg-teal/5 hover:border-teal/50 transition-colors';

export default function AddPageButtons({
  isDocuments,
  canAddPricing,
  canAddToc,
  onAddPricing,
  onAddPackages,
  onAddText,
  onAddSection,
  onAddToc,
}: AddPageButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {canAddPricing && (
        <button onClick={onAddPricing} className={btnClass}>
          <DollarSign size={12} />
          Add Pricing Page
        </button>
      )}
      {!isDocuments && (
        <button onClick={onAddPackages} className={btnClass}>
          <Package size={12} />
          Add Packages Page
        </button>
      )}
      <button onClick={onAddText} className={btnClass}>
        <FileText size={12} />
        Add Text Page
      </button>
      <button onClick={onAddSection} className={btnClass}>
        <FolderOpen size={12} />
        Add Section Header
      </button>
      {canAddToc && (
        <button onClick={onAddToc} className={btnClass}>
          <List size={12} />
          Add Contents Page
        </button>
      )}
    </div>
  );
}
