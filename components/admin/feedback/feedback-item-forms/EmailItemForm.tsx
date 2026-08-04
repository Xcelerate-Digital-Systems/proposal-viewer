'use client';

import { useState } from 'react';
import { Code, Type } from 'lucide-react';
import EmailMockupPreview from '@/components/admin/feedback/EmailMockupPreview';
import EmailBodyEditor from '@/components/admin/feedback/EmailBodyEditor';
import FormActions from './FormActions';

export type EmailEditorMode = 'richtext' | 'html';

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
  const [editorMode, setEditorMode] = useState<EmailEditorMode>('richtext');
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
      <div className={`${showPreview ? 'w-1/2 border-r border-edge-strong' : 'w-full'} p-6 space-y-4 overflow-y-auto`}>
        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">
            Item Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. March Newsletter – Subject Test"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 "
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">
            Subject Line <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Your email subject line…"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 "
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">
            Preheader
          </label>
          <input
            type="text"
            value={emailPreheader}
            onChange={(e) => setEmailPreheader(e.target.value)}
            placeholder="Preview text shown after subject in inbox…"
            className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 "
          />
          <p className="text-2xs text-faint mt-1">
            The short text visible in the inbox beside the subject line
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-dim uppercase tracking-wider">
              {editorMode === 'richtext' ? 'Body Text' : 'HTML Email Code'}
            </label>
            <div className="flex items-center gap-0.5 bg-surface rounded-full p-0.5 border border-edge">
              <button
                type="button"
                onClick={() => setEditorMode('richtext')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-medium transition-colors ${
                  editorMode === 'richtext'
                    ? 'bg-teal text-white'
                    : 'text-dim hover:text-prose'
                }`}
              >
                <Type size={11} />
                Rich Text
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('html')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-medium transition-colors ${
                  editorMode === 'html'
                    ? 'bg-teal text-white'
                    : 'text-dim hover:text-prose'
                }`}
              >
                <Code size={11} />
                HTML
              </button>
            </div>
          </div>

          {editorMode === 'richtext' ? (
            <EmailBodyEditor
              content={emailBody}
              onChange={setEmailBody}
            />
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder={'Paste your full HTML email code here…\n\n<!DOCTYPE html>\n<html>\n<head>…</head>\n<body>…</body>\n</html>'}
                className="w-full px-3 py-2.5 bg-surface border border-edge-strong rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 font-mono leading-relaxed min-h-[240px] resize-y"
                spellCheck={false}
              />
              <p className="text-2xs text-faint">
                Paste full HTML from Mailchimp, Klaviyo, or any email builder. Preview will render exactly as it appears in email clients.
              </p>
            </div>
          )}
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
        <div className="w-1/2 p-6 overflow-y-auto bg-surface flex items-start justify-center">
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
