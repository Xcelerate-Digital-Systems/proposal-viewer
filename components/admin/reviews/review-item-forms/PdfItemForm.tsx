// components/admin/reviews/review-item-forms/PdfItemForm.tsx
'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

interface PdfItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
}

export default function PdfItemForm({ onSubmit, onBack, onCancel, uploading }: PdfItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    if (selected.size > 50 * 1024 * 1024) {
      toast.error('PDF must be under 50MB');
      return;
    }
    setFile(selected);
    if (!title.trim()) {
      setTitle(selected.name.replace(/\.pdf$/i, ''));
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    await onSubmit(
      {
        title: title.trim(),
        type: 'pdf',
      },
      file,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Item Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Campaign Brief – March 2026"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            PDF File <span className="text-red-400">*</span>
          </label>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{(file.size / (1024 * 1024)).toFixed(1)}MB</p>
              </div>
              <button type="button" onClick={clearFile}>
                <X size={14} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-600">Upload PDF</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Up to 50MB</p>
            </button>
          )}
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!file || !title.trim() || uploading}
          uploading={uploading}
        />
      </div>
    </form>
  );
}
