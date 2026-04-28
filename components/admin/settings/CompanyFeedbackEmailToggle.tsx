'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

/**
 * Company-level kill switch for feedback comment email notifications.
 * Distinct from per-team-member preferences — when off, no participant
 * (team, project owner, or guest reviewer) receives comment/reply emails
 * for any of this company's feedback projects.
 */
export default function CompanyFeedbackEmailToggle({ companyId }: { companyId: string }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('feedback_email_notifications_enabled')
        .eq('id', companyId)
        .single();
      if (cancelled) return;
      // Default to true when the column doesn't exist yet (pre-migration).
      const value = (data as Record<string, unknown> | null)?.feedback_email_notifications_enabled;
      setEnabled(value === false ? false : true);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    const { error } = await supabase
      .from('companies')
      .update({ feedback_email_notifications_enabled: next, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    setSaving(false);
    if (error) {
      toast.error('Failed to update');
      return;
    }
    setEnabled(next);
    toast.success(next ? 'Feedback emails on' : 'Feedback emails off');
  };

  const isOn = enabled ?? true;

  return (
    <div className="bg-white border border-edge rounded-[14px] overflow-hidden">
      <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">Feedback emails (company-wide)</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded">
          Feedback
        </span>
      </div>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Mail size={15} className={isOn ? 'text-teal shrink-0' : 'text-faint shrink-0'} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Comment & reply notifications</p>
            <p className="text-xs text-faint">
              Email everyone who has commented (team + guests with email) when a new comment or reply is posted.
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving || enabled === null}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isOn ? 'bg-teal' : 'bg-edge'}`}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          ) : (
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform absolute top-0.5 ${
                isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          )}
        </button>
      </div>
    </div>
  );
}
