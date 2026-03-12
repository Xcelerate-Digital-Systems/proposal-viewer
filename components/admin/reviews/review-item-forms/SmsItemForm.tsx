// components/admin/reviews/review-item-forms/SmsItemForm.tsx
'use client';

import { useState } from 'react';
import SmsMockupPreview from '@/components/admin/reviews/SmsMockupPreview';
import FormActions from './FormActions';

interface SmsItemFormProps {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
}

export default function SmsItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange }: SmsItemFormProps) {
  const [title, setTitle] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const togglePreview = () => {
    const next = !showPreview;
    setShowPreview(next);
    onPreviewChange?.(next);
  };

  const isValid = !!title.trim() && !!smsBody.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    await onSubmit({
      title: title.trim(),
      type: 'sms',
      sms_body: smsBody.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
      <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-4 overflow-y-auto`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Item Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Appointment Reminder SMS"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            rows={5}
            placeholder="Your SMS message text…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-y min-h-[100px]"
          />
          <p className="text-[10px] mt-1" style={{ color: smsBody.length > 160 ? '#f59e0b' : '#9ca3af' }}>
            {smsBody.length} / 160 characters
            {smsBody.length > 160 && ` · ${Math.ceil(smsBody.length / 160)} segments`}
          </p>
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!isValid || uploading}
          uploading={uploading}
          previewToggle={{ visible: showPreview, enabled: true, onToggle: togglePreview }}
        />
      </div>

      {showPreview && (
        <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <SmsMockupPreview
            body={smsBody || 'Your SMS message will appear here…'}
            senderName="Your Brand"
            client="imessage"
            showClientToggle
          />
        </div>
      )}
    </form>
  );
}
