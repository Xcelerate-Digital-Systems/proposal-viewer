// components/admin/reviews/review-item-forms/WebpageItemForm.tsx
'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import FormActions from './FormActions';

interface WebpageItemFormProps {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
}

export default function WebpageItemForm({ onSubmit, onBack, onCancel, uploading }: WebpageItemFormProps) {
  const [title, setTitle] = useState('');
  const [webpageUrl, setWebpageUrl] = useState('');

  const isValid = !!title.trim() && !!webpageUrl.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    await onSubmit({
      title: title.trim(),
      type: 'webpage',
      url: webpageUrl.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Staging Site Homepage"
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          URL <span className="text-red-400">*</span>
        </label>
        <input
          type="url"
          value={webpageUrl}
          onChange={(e) => setWebpageUrl(e.target.value)}
          placeholder="https://staging.example.com"
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          The page where you&apos;ll embed the feedback widget
        </p>
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
            <Globe size={16} className="text-teal" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700">How it works</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              After adding this item, you&apos;ll get a script tag to paste into your page&apos;s {`<head>`}.
              This adds a feedback widget so your client can pin comments directly on the live page.
            </p>
          </div>
        </div>
      </div>

      <FormActions onBack={onBack} onCancel={onCancel} disabled={!isValid || uploading} uploading={uploading} />
    </form>
  );
}
