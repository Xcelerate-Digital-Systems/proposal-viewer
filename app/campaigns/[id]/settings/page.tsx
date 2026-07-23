'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Send, Clock, BookmarkPlus } from 'lucide-react';
import SaveAsWorkflowTemplateModal from '@/components/admin/feedback/SaveAsWorkflowTemplateModal';
import AdminLayout from '@/components/admin/AdminLayout';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import ProjectAssigneesPanel from '@/components/admin/feedback/ProjectAssigneesPanel';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import DatePicker from '@/components/ui/DatePicker';
import { REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
import {
  STAGES_WITH_DUE_DATES,
  getStageDueDateUrgency,
  formatStageDueDate,
} from '@/lib/feedback/stage-due-dates';

export default function FeedbackProjectSettingsPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => (
        <SettingsContent
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function SettingsContent({
  projectId,
  companyId,
  userId,
}: {
  projectId: string;
  companyId: string;
  userId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [hasWebpages, setHasWebpages] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const [dueDate, setDueDate] = useState('');
  const [savingDue, setSavingDue] = useState(false);
  const [stageDueDates, setStageDueDates] = useState<Record<string, string>>({});
  const [savingStage, setSavingStage] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminderMode, setReminderMode] = useState<'all' | 'select'>('all');
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<{ email: string; name: string; removed: boolean }[]>([]);

  const fetchProject = useCallback(async () => {
    const [{ data: p }, { data: items }] = await Promise.all([
      supabase
        .from('review_projects')
        .select('*')
        .eq('id', projectId)
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('review_items')
        .select('id')
        .eq('review_project_id', projectId)
        .eq('type', 'webpage')
        .limit(1),
    ]);

    if (!p) {
      router.push('/campaigns');
      return;
    }
    setProject(p);
    setDueDate(p.due_date ?? '');
    setStageDueDates(p.stage_due_dates ?? {});
    setHasWebpages((items?.length ?? 0) > 0);
    setLoading(false);
  }, [projectId, companyId, router]);

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
  }, [companyId]);

  const fetchGuests = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/campaigns/${projectId}/guests?company_id=${companyId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      setGuests(data.guests || []);
    }
  }, [projectId, companyId]);

  useEffect(() => {
    fetchProject();
    fetchCustomDomain();
    fetchGuests();
  }, [fetchProject, fetchCustomDomain, fetchGuests]);

  const saveDueDate = async (value: string) => {
    setDueDate(value);
    setSavingDue(true);
    const { error } = await supabase
      .from('review_projects')
      .update({ due_date: value || null, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    setSavingDue(false);
    if (error) {
      toast.error('Failed to save due date');
      setDueDate(project?.due_date ?? '');
    } else {
      setProject((prev) => (prev ? { ...prev, due_date: value || null } : prev));
    }
  };

  const saveStageDueDate = async (stage: string, value: string) => {
    const next = { ...stageDueDates };
    if (value) {
      next[stage] = value;
    } else {
      delete next[stage];
    }
    setStageDueDates(next);
    setSavingStage(stage);
    const { error } = await supabase
      .from('review_projects')
      .update({ stage_due_dates: next, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    setSavingStage(null);
    if (error) {
      toast.error('Failed to save stage due date');
      setStageDueDates(project?.stage_due_dates ?? {});
    } else {
      setProject((prev) => (prev ? { ...prev, stage_due_dates: next } : prev));
    }
  };

  const activeGuests = guests.filter((g) => !g.removed);

  const sendReminder = async (targetEmails?: string[]) => {
    const count = targetEmails ? targetEmails.length : activeGuests.length;
    const label = targetEmails
      ? `${count} selected guest${count !== 1 ? 's' : ''}`
      : 'all guests assigned to this project';
    const ok = await confirm({
      title: 'Send reminder?',
      message: `This will email ${label}. Continue?`,
      confirmLabel: 'Send Reminder',
    });
    if (!ok) return;
    setReminding(true);
    try {
      const body = targetEmails ? { emails: targetEmails } : {};
      const res = await authFetch(`/api/campaigns/${projectId}/remind?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Reminder sent to ${data.sent} guest${data.sent !== 1 ? 's' : ''}`);
        setSelectedGuests(new Set());
        setReminderMode('all');
      } else {
        toast.error(data.error || 'Failed to send reminders');
      }
    } catch {
      toast.error('Failed to send reminders');
    }
    setReminding(false);
  };

  const dueDateObj = dueDate ? new Date(dueDate + 'T00:00:00') : null;
  const dueDateLabel = dueDateObj
    ? dueDateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const isOverdue = dueDate ? new Date(dueDate + 'T23:59:59') < new Date() : false;

  const dueRelative = (() => {
    if (!dueDateObj) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((dueDateObj.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `${diff} days from now`;
    if (diff < -1) return `${Math.abs(diff)} days ago`;
    return null;
  })();

  const [dueSaved, setDueSaved] = useState(false);
  const saveDueDateWithFeedback = (value: string) => {
    saveDueDate(value);
    if (value) {
      setDueSaved(true);
      setTimeout(() => setDueSaved(false), 1200);
    }
  };

  const toISODate = (d: Date) => d.toISOString().split('T')[0];
  const quickDates = [
    { label: 'Tomorrow', date: () => { const d = new Date(); d.setDate(d.getDate() + 1); return toISODate(d); } },
    { label: 'Next week', date: () => { const d = new Date(); d.setDate(d.getDate() + 7); return toISODate(d); } },
    { label: '2 weeks', date: () => { const d = new Date(); d.setDate(d.getDate() + 14); return toISODate(d); } },
    { label: 'Next month', date: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return toISODate(d); } },
  ];

  return (
    <div className="flex flex-col h-full">
      {project && (
        <FeedbackProjectHeader
          projectId={projectId}
          project={project}
          setProject={setProject}
          customDomain={customDomain}
          hasWebpages={hasWebpages}
          activeTab="settings"
        />
      )}

      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading || !project ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Due Date ────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={15} className="text-faint" />
                <h3 className="text-sm font-semibold text-ink">Due Date</h3>
              </div>
              <p className="text-caption text-dim mb-3">
                Set a deadline for this review. Shown in reminder emails sent to guests.
              </p>

              {dueDate && dueDateLabel ? (
                <div className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  isOverdue
                    ? 'border-red-200 bg-red-50'
                    : 'border-edge bg-white'
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isOverdue ? 'bg-red-100' : 'bg-teal/10'
                  }`}>
                    {dueSaved ? (
                      <Check size={16} className="text-emerald-500" />
                    ) : savingDue ? (
                      <div className="w-4 h-4 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
                    ) : (
                      <CalendarDays size={16} className={isOverdue ? 'text-red-500' : 'text-teal'} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-caption font-semibold ${isOverdue ? 'text-red-700' : 'text-ink'}`}>
                      {dueDateLabel}
                    </p>
                    {dueRelative && (
                      <p className={`text-detail ${isOverdue ? 'text-red-500' : 'text-dim'}`}>
                        {isOverdue ? 'Overdue' : dueRelative}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <DatePicker value={dueDate} onChange={saveDueDateWithFeedback}>
                      <span className="text-xs text-faint hover:text-prose transition-colors">
                        Change
                      </span>
                    </DatePicker>
                    <span className="text-edge-strong">·</span>
                    <button
                      type="button"
                      onClick={() => saveDueDate('')}
                      className="text-xs text-faint hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <DatePicker value={dueDate} onChange={saveDueDateWithFeedback}>
                      <div className="inline-flex items-center gap-2 px-3.5 py-2 border border-dashed border-edge-hover rounded-xl cursor-pointer hover:border-edge-strong hover:bg-surface/50 transition-colors group">
                        <CalendarDays size={15} className="text-faint group-hover:text-dim transition-colors" />
                        <span className="text-caption text-dim group-hover:text-ink transition-colors">Pick a date</span>
                      </div>
                    </DatePicker>
                    {savingDue && (
                      <div className="w-4 h-4 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {quickDates.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => saveDueDateWithFeedback(q.date())}
                        className="px-2.5 py-1 text-detail font-medium text-dim hover:text-teal hover:bg-teal/5 rounded-lg transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Stage Due Dates ─────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={15} className="text-faint" />
                <h3 className="text-sm font-semibold text-ink">Stage Deadlines</h3>
              </div>
              <p className="text-caption text-dim mb-3">
                Set per-stage deadlines. Assignees receive automated reminders when a stage is due within 24 hours.
              </p>

              <div className="space-y-2">
                {STAGES_WITH_DUE_DATES.map((stage) => {
                  const def = REVIEW_STATUS_CONFIG[stage];
                  const dateVal = stageDueDates[stage] ?? '';
                  const urgency = dateVal ? getStageDueDateUrgency(dateVal) : null;
                  const relative = dateVal ? formatStageDueDate(dateVal) : null;
                  const isSaving = savingStage === stage;

                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${
                        urgency === 'overdue'
                          ? 'border-red-200 bg-red-50/50'
                          : urgency === 'soon'
                            ? 'border-amber-200 bg-amber-50/50'
                            : 'border-edge bg-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${def.dot}`} />
                      <span className="text-caption font-medium text-ink w-32 shrink-0">{def.label}</span>

                      {dateVal ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`text-caption ${
                            urgency === 'overdue' ? 'text-red-600 font-semibold' :
                            urgency === 'soon' ? 'text-amber-700 font-medium' :
                            'text-dim'
                          }`}>
                            {new Date(dateVal + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                          {relative && (
                            <span className={`text-detail ${
                              urgency === 'overdue' ? 'text-red-500' :
                              urgency === 'soon' ? 'text-amber-600' :
                              'text-faint'
                            }`}>
                              {urgency === 'overdue' ? `(${relative})` : `(${relative})`}
                            </span>
                          )}
                          {isSaving && (
                            <div className="w-3.5 h-3.5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
                          )}
                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            <DatePicker value={dateVal} onChange={(v) => saveStageDueDate(stage, v)}>
                              <span className="text-xs text-faint hover:text-prose transition-colors cursor-pointer">
                                Change
                              </span>
                            </DatePicker>
                            <span className="text-edge-strong">·</span>
                            <button
                              type="button"
                              onClick={() => saveStageDueDate(stage, '')}
                              className="text-xs text-faint hover:text-red-500 transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <DatePicker value="" onChange={(v) => saveStageDueDate(stage, v)}>
                            <span className="text-xs text-dim hover:text-teal cursor-pointer transition-colors">
                              Set deadline
                            </span>
                          </DatePicker>
                          {isSaving && (
                            <div className="w-3.5 h-3.5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Email Reminders ─────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Send size={15} className="text-faint" />
                <h3 className="text-sm font-semibold text-ink">Email Reminders</h3>
              </div>
              <p className="text-caption text-dim mb-3">
                Send a reminder email to guests prompting them to review.
              </p>

              <div className="flex items-center gap-1 mb-3">
                <button
                  type="button"
                  onClick={() => { setReminderMode('all'); setSelectedGuests(new Set()); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    reminderMode === 'all'
                      ? 'bg-teal/10 text-teal'
                      : 'text-dim hover:text-prose hover:bg-surface'
                  }`}
                >
                  All Guests
                </button>
                <button
                  type="button"
                  onClick={() => setReminderMode('select')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    reminderMode === 'select'
                      ? 'bg-teal/10 text-teal'
                      : 'text-dim hover:text-prose hover:bg-surface'
                  }`}
                >
                  Select Guests
                </button>
              </div>

              {reminderMode === 'select' && (
                <div className="border border-edge rounded-xl bg-white divide-y divide-gray-100 mb-3 max-h-60 overflow-y-auto">
                  {activeGuests.length === 0 ? (
                    <div className="px-4 py-4 text-caption text-faint text-center">
                      No active guests on this project.
                    </div>
                  ) : (
                    activeGuests.map((g) => (
                      <label key={g.email} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedGuests.has(g.email)}
                          onChange={() => {
                            setSelectedGuests((prev) => {
                              const next = new Set(prev);
                              if (next.has(g.email)) next.delete(g.email);
                              else next.add(g.email);
                              return next;
                            });
                          }}
                          className="h-3.5 w-3.5 rounded border-edge-strong text-teal focus:ring-teal/30 accent-teal"
                        />
                        <div className="min-w-0">
                          <p className="text-caption font-medium text-ink truncate">{g.name || g.email}</p>
                          {g.name && <p className="text-xs text-faint truncate">{g.email}</p>}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  reminderMode === 'select' && selectedGuests.size > 0
                    ? sendReminder(Array.from(selectedGuests))
                    : sendReminder()
                }
                disabled={reminding || (reminderMode === 'select' && selectedGuests.size === 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-caption font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
              >
                {reminding ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {reminderMode === 'select' && selectedGuests.size > 0
                  ? `Send Reminder to ${selectedGuests.size} Guest${selectedGuests.size !== 1 ? 's' : ''}`
                  : 'Send Reminder to All Guests'
                }
              </button>
            </div>

            {/* ── Assignees ───────────────────────────────────── */}
            <ProjectAssigneesPanel
              projectId={projectId}
              companyId={companyId}
              currentUserId={userId}
            />

            {/* ── Save as Workflow Template ──────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookmarkPlus size={15} className="text-faint" />
                <h3 className="text-sm font-semibold text-ink">Workflow Template</h3>
              </div>
              <p className="text-caption text-dim mb-3">
                Save this campaign's assignee and stage configuration as a reusable template for new campaigns.
              </p>
              <button
                type="button"
                onClick={() => setShowSaveTemplate(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-caption font-medium border border-edge-strong rounded-lg hover:border-edge-hover hover:bg-surface/50 transition-colors"
              >
                <BookmarkPlus size={14} />
                Save as Template
              </button>
            </div>

            {showSaveTemplate && (
              <SaveAsWorkflowTemplateModal
                companyId={companyId}
                projectId={projectId}
                onClose={() => setShowSaveTemplate(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
