'use client';

import { ChevronLeft } from 'lucide-react';

interface FormActionsProps {
  onBack: () => void;
  onCancel: () => void;
  disabled: boolean;
  uploading: boolean;
  /** Optional preview toggle */
  previewToggle?: {
    visible: boolean;
    enabled: boolean;
    onToggle: () => void;
  };
  /** Override primary button label (defaults to "Add Item"). */
  submitLabel?: string;
}

export default function FormActions({
  onBack,
  onCancel,
  disabled,
  uploading,
  previewToggle,
  submitLabel,
}: FormActionsProps) {
  return (
    <div className="pt-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={14} /> Change type
        </button>
        {previewToggle && previewToggle.enabled && (
          <button
            type="button"
            onClick={previewToggle.onToggle}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              previewToggle.visible
                ? 'bg-teal/10 text-teal'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {previewToggle.visible ? 'Hide Preview' : 'Show Preview'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="px-5 py-2 bg-teal text-white text-sm font-semibold rounded-full hover:bg-teal-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {uploading ? 'Saving…' : (submitLabel || 'Add Item')}
        </button>
      </div>
    </div>
  );
}
