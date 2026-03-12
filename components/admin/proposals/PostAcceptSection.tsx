// components/admin/proposals/PostAcceptSection.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, MessageSquare, X, Check, Loader2, ArrowRight, Calendar, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { inputClassName } from '@/components/ui/FormField';
import { isValidHttpUrl } from '@/lib/sanitize';

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
    icon: <X size={15} className="text-gray-400" />,
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal/10">
            <ArrowRight size={16} className="text-teal" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">After Acceptance</h4>
            <p className="text-xs text-gray-400">
              {isTemplate
                ? 'Default action copied to proposals created from this template'
                : 'What happens when a client clicks Approve & Continue'}
            </p>
          </div>
        </div>
        <div className="h-5 flex items-center">
          {saveStatus === 'saving' && <Loader2 size={13} className="animate-spin text-gray-300" />}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>

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
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {opt.icon}
                <span className={`text-xs font-medium ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                  {opt.label}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-tight">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Redirect URL input */}
      {action === 'redirect' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Redirect URL</label>
          <input
            type="url"
            value={redirectUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://buy.stripe.com/... or https://calendly.com/..."
            className={inputClassName}
          />
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] text-gray-400">Common uses:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500">
              <CreditCard size={9} /> Payment link
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500">
              <Calendar size={9} /> Booking page
            </span>
          </div>
        </div>
      )}

      {/* Custom message textarea */}
      {action === 'message' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Confirmation Message</label>
          <textarea
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            rows={3}
            placeholder="e.g. Thank you for approving! We'll be in touch within 24 hours to kick things off."
            className={`${inputClassName} resize-none`}
          />
          <p className="text-[10px] text-gray-400">
            {isTemplate
              ? 'This default message will be pre-filled when creating proposals from this template.'
              : 'This message is shown to the client inside the approval modal after they submit their name.'}
          </p>
        </div>
      )}
    </div>
  );
}