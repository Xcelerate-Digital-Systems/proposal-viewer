'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { FunnelNodeMessage } from '@/lib/types/funnel';
import EmailMockupPreview, { type EmailClient } from '@/components/admin/feedback/EmailMockupPreview';
import SmsMockupPreview, { type SmsClient } from '@/components/admin/feedback/SmsMockupPreview';

interface Props {
  message: FunnelNodeMessage;
  /** Node label, shown as the modal title so it's obvious which node opened. */
  title: string;
  /** Falls back to the agency/company name in the public viewer. */
  senderName?: string;
  accentColor?: string;
  onClose: () => void;
}

/**
 * Read-only preview of the email/SMS attached to a funnel node.
 *
 * Reuses the same mockup components the Campaigns viewer renders, so an email
 * looks like an inbox row and an SMS looks like a phone thread. Deliberately
 * has no commenting or feedback layer — this is a reference surface, not a
 * review one.
 *
 * Rendered through a portal so it escapes the React Flow canvas, which
 * establishes its own stacking and transform context.
 */
export default function NodeMessageModal({
  message, title, senderName, accentColor, onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [emailClient, setEmailClient] = useState<EmailClient>('inbox_preview');
  const [smsClient, setSmsClient] = useState<SmsClient>('imessage');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="node-message-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-ink/50 flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-edge shrink-0">
            <div className="min-w-0">
              <div className="text-2xs uppercase tracking-wider font-semibold text-muted">
                {message.kind === 'email' ? 'Email' : 'SMS'}
              </div>
              <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-surface">
            {message.kind === 'email' ? (
              <div className="max-w-xl mx-auto">
                <EmailMockupPreview
                  subject={message.subject || ''}
                  preheader={message.preheader || ''}
                  body={message.body}
                  senderName={message.from || senderName || 'Your business'}
                  client={emailClient}
                  showClientToggle
                  accentColor={accentColor}
                  onClientChange={setEmailClient}
                />
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <SmsMockupPreview
                  body={message.body}
                  senderName={senderName || 'Your business'}
                  client={smsClient}
                  showClientToggle
                  accentColor={accentColor}
                  onClientChange={setSmsClient}
                />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
