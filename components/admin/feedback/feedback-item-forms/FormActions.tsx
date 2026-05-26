'use client';

import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={uploading} disabled={disabled}>
          {submitLabel || 'Add Item'}
        </Button>
      </div>
    </div>
  );
}
