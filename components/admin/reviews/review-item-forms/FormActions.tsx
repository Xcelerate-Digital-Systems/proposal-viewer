// components/admin/reviews/review-item-forms/FormActions.tsx
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
}

export default function FormActions({
  onBack,
  onCancel,
  disabled,
  uploading,
  previewToggle,
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
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              previewToggle.visible
                ? 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]'
                : 'text-gray-500 border-gray-200 hover:border-gray-300'
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
          className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="px-5 py-2.5 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading…' : 'Add Item'}
        </button>
      </div>
    </div>
  );
}
