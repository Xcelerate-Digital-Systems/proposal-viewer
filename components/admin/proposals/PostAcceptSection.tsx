// components/admin/proposals/PostAcceptSection.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, MessageSquare, X, Check, Loader2, ArrowRight, Calendar, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { inputClassName } from '@/components/ui/FormField';
import { isValidHttpUrl } from '@/lib/sanitize';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

type PostAcceptAction = 'redirect' | 'message' | null;

interface PostAcceptSectionProps {
  entityId: string;
  table?: 'proposals' | 'proposal_templates';
  initialAction: PostAcceptAction;
  initialRedirectUrl: string | null;
  initialMessage: string | null;
}

const ACTION_OPTIONS: {
  value: PostAcceptAction;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: null,
    label: 'No action',
    description: 'Modal simply closes after approval',
    icon: <X size={15} className="text-faint" />,
  },
  {
    value: 'redirect',
    label: 'Redirect to URL',
    description: 'Send client to a payment link, calendar, or any page',
    icon: <ExternalLink size={15} className="text-teal" />,
  },
  {
    value: 'message',
    label: 'Show a message',
    description: 'Display a custom confirmation message to the client',
    icon: <MessageSquare size={15} className="text-violet-500" />,
  },
];

export default function PostAcceptSection({
  entityId,
  table = 'proposals',
  initialAction,
  initialRedirectUrl,
  initialMessage,
}: PostAcceptSectionProps) {
  const toast = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [action, setAction] = useState<PostAcceptAction>(initialAction);
  const [redirectUrl, setRedirectUrl] = useState(initialRedirectUrl ?? '');
  const [message, setMessage] = useState(initialMessage ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);

  const isTemplate = table === 'proposal_templates';

  const save = useCallback(async (
    currentAction: PostAcceptAction,
    currentUrl: string,
    currentMessage: string,
  ) => {
    setSaveStatus('saving');
    try {
      const trimmedUrl = currentUrl.trim() || null;
      if (currentAction === 'redirect' && trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
        setSaveStatus('idle');
        toast.error('Redirect URL must start with http:// or https://');
        return;
      }

      const { error } = await supabase
        .from(table)
        .update({
          post_accept_action: currentAction,
          post_accept_redirect_url: currentAction === 'redirect' ? trimmedUrl : null,
          post_accept_message: currentAction === 'message' ? (currentMessage.trim() || null) : null,
        })
        .eq('id', entityId);

      if (error) throw error;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
      toast.error('Failed to save post-acceptance settings');
    }
  }, [entityId, table, toast]);

  const scheduleSave = useCallback((
    newAction: PostAcceptAction,
    newUrl: string,
    newMessage: string,
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(newAction, newUrl, newMessage), 800);
  }, [save]);

  const handleActionChange = (newAction: PostAcceptAction) => {
    setAction(newAction);
    scheduleSave(newAction, redirectUrl, message);
  };

  const handleUrlChange = (val: string) => {
    setRedirectUrl(val);
    scheduleSave(action, val, message);
  };

  const handleMessageChange = (val: string) => {
    setMessage(val);
    scheduleSave(action, redirectUrl, val);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <SectionCard
      title="After Acceptance"
      description={isTemplate
        ? 'Default action copied to proposals created from this template'
        : 'What happens when a client clicks Approve & Continue'}
      icon={<ArrowRight size={14} className="text-faint" />}
    >
      <div className="space-y-4">
      {/* Action selector */}
      <div className="grid grid-cols-3 gap-2">
        {ACTION_OPTIONS.map((opt) => {
          const selected = action === opt.value;
          return (
            <button
              key={String(opt.value)}
              onClick={() => handleActionChange(opt.value)}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all ${
                selected
                  ? 'border-teal/40 bg-teal/5 ring-1 ring-teal/20'
                  : 'border-edge-strong bg-surface hover:border-edge-hover hover:bg-surface'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {opt.icon}
                <span className={`text-xs font-medium ${selected ? 'text-ink' : 'text-prose'}`}>
                  {opt.label}
                </span>
              </div>
              <p className="text-2xs text-faint leading-tight">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Redirect URL input */}
      {action === 'redirect' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-prose">Redirect URL</label>
          <input
            type="url"
            value={redirectUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://buy.stripe.com/... or https://calendly.com/..."
            className={inputClassName}
          />
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-2xs text-faint">Common uses:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface text-2xs text-dim">
              <CreditCard size={9} /> Payment link
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface text-2xs text-dim">
              <Calendar size={9} /> Booking page
            </span>
          </div>
        </div>
      )}

      {/* Custom message textarea */}
      {action === 'message' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-prose">Confirmation Message</label>
          <textarea
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            rows={3}
            placeholder="e.g. Thank you for approving! We'll be in touch within 24 hours to kick things off."
            className={`${inputClassName} resize-none`}
          />
          <p className="text-2xs text-faint">
            {isTemplate
              ? 'This default message will be pre-filled when creating proposals from this template.'
              : 'This message is shown to the client inside the approval modal after they submit their name.'}
          </p>
        </div>
      )}
      </div>
    </SectionCard>
  );
}