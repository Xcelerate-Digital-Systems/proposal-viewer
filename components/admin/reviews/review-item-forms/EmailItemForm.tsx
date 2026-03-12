// components/admin/reviews/review-item-forms/EmailItemForm.tsx
'use client';

import { useState } from 'react';
import EmailMockupPreview from '@/components/admin/reviews/EmailMockupPreview';
import FormActions from './FormActions';

interface EmailItemFormProps {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
}

export default function EmailItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange }: EmailItemFormProps) {
  const [title, setTitle] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailPreheader, setEmailPreheader] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const togglePreview = () => {
    const next = !showPreview;
    setShowPreview(next);
    onPreviewChange?.(next);
  };

  const isValid = !!title.trim() && !!emailSubject.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    await onSubmit({
      title: title.trim(),
      type: 'email',
      email_subject: emailSubject.trim(),
      email_preheader: emailPreheader.trim() || null,
      email_body: emailBody.trim() || null,
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
            placeholder="e.g. March Newsletter – Subject Test"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Subject Line <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Your email subject line…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Preheader
          </label>
          <input
            type="text"
            value={emailPreheader}
            onChange={(e) => setEmailPreheader(e.target.value)}
            placeholder="Preview text shown after subject in inbox…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            The short text visible in the inbox beside the subject line
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Body Text
          </label>
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={5}
            placeholder="The main email body copy…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-y min-h-[100px]"
          />
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
          <EmailMockupPreview
            subject={emailSubject || 'Your subject line'}
            preheader={emailPreheader || 'Preheader text goes here…'}
            body={emailBody || 'Email body text will appear here…'}
            senderName="Your Brand"
            client="inbox_preview"
            showClientToggle
          />
        </div>
      )}
    </form>
  );
}
