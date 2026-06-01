// components/admin/page-editor/InsertPageMenu.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, FileUp, FileText, DollarSign, X } from 'lucide-react';

interface InsertPageMenuProps {
  /** Label shown on the trigger button */
  label?: string;
  /** Whether this is the "insert at start" button (before all pages) */
  isStart?: boolean;
  /** Disable the button (e.g. during PDF processing) */
  disabled?: boolean;
  /** Whether to show the pricing option (false for documents) */
  showPricing?: boolean;
  /** Called when user selects "Upload PDF Page" and picks a file */
  onInsertPdf: (file: File) => void;
  /** Called when user selects "Add Text Page" */
  onInsertTextPage: () => void;
  /** Called when user selects "Add Pricing Page" */
  onInsertPricingPage?: () => void;
}

export default function InsertPageMenu({
  label = 'Insert',
  isStart = false,
  disabled = false,
  showPricing = true,
  onInsertPdf,
  onInsertTextPage,
  onInsertPricingPage,
}: InsertPageMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handlePdfSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        onInsertPdf(f);
        setOpen(false);
      }
      e.target.value = '';
    },
    [onInsertPdf]
  );

  const handleTextPage = useCallback(() => {
    onInsertTextPage();
    setOpen(false);
  }, [onInsertTextPage]);

  const handlePricingPage = useCallback(() => {
    onInsertPricingPage?.();
    setOpen(false);
  }, [onInsertPricingPage]);

  const canShowPricing = showPricing && !!onInsertPricingPage;

  return (
    <div className="relative flex justify-center py-1" ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2.5 py-1 rounded text-2xs transition-colors ${
          disabled
            ? 'text-gray-300 cursor-not-allowed'
            : open
            ? 'text-teal bg-teal/10'
            : 'text-faint hover:text-teal hover:bg-teal/5 cursor-pointer'
        }`}
        title={isStart ? 'Insert page at start' : 'Insert page here'}
      >
        <Plus size={10} />
        {label}
      </button>

      {/* Hidden file input for PDF uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Popover menu */}
      {open && (
        <div className="absolute z-50 top-full mt-1 bg-white rounded-lg shadow-lg border border-edge-strong py-1 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
          {/* PDF upload option */}
          <button
            type="button"
            onClick={handlePdfSelect}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-prose hover:bg-surface hover:text-ink transition-colors text-left"
          >
            <FileUp size={14} className="text-faint shrink-0" />
            <div>
              <div className="font-medium">PDF Page</div>
              <div className="text-2xs text-faint mt-0.5">Upload a PDF file</div>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-edge my-1" />

          {/* Text page option */}
          <button
            type="button"
            onClick={handleTextPage}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-prose hover:bg-surface hover:text-ink transition-colors text-left"
          >
            <FileText size={14} className="text-teal/60 shrink-0" />
            <div>
              <div className="font-medium">Text Page</div>
              <div className="text-2xs text-faint mt-0.5">Rich text content page</div>
            </div>
          </button>

          {/* Quote page option (only for proposals/templates) */}
          {canShowPricing && (
            <button
              type="button"
              onClick={handlePricingPage}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-prose hover:bg-surface hover:text-ink transition-colors text-left"
            >
              <DollarSign size={14} className="text-teal/60 shrink-0" />
              <div>
                <div className="font-medium">Quote Page</div>
                <div className="text-2xs text-faint mt-0.5">Add investment breakdown</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}