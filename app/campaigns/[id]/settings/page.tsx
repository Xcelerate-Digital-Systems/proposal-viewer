'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Send } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import ProjectAssigneesPanel from '@/components/admin/feedback/ProjectAssigneesPanel';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';

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
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [hasWebpages, setHasWebpages] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dueDate, setDueDate] = useState('');
  const [savingDue, setSavingDue] = useState(false);
  const [reminding, setReminding] = useState(false);

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
    setHasWebpages((items?.length ?? 0) > 0);
    setLoading(false);
  }, [projectId, companyId, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

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

  const sendReminder = async () => {
    setReminding(true);
    try {
      const res = await authFetch(`/api/campaigns/${projectId}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Reminder sent to ${data.sent} guest${data.sent !== 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to send reminders');
      }
    } catch {
      toast.error('Failed to send reminders');
    }
    setReminding(false);
  };

  const dueDateLabel = dueDate
    ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;
  const isOverdue = dueDate ? new Date(dueDate + 'T23:59:59') < new Date() : false;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white px-6 lg:px-10 pt-5">
        {project && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <Link
                  href="/campaigns"
                  className="text-faint hover:text-prose transition-colors shrink-0"
                  title="All Projects"
                >
                  <ArrowLeft size={16} />
                </Link>
                <div className="min-w-0">
                  <h1 className="text-[17px] font-semibold tracking-tight text-ink font-[family-name:var(--font-display)] truncate">
                    {project.title}
                  </h1>
                  {project.client_name && (
                    <p className="text-xs text-faint truncate">{project.client_name}</p>
                  )}
                </div>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="settings" hasWebpages={hasWebpages} />
          </>
        )}
      </div>

      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading || !project ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Due Date & Reminder ─────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays size={15} className="text-faint" />
                  <h3 className="text-sm font-semibold text-ink">Due Date</h3>
                </div>
                <p className="text-caption text-dim mb-3">
                  Set a deadline for this review. Shown in reminder emails sent to guests.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => saveDueDate(e.target.value)}
                    className="px-3 py-1.5 text-caption border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />
                  {dueDateLabel && (
                    <span className={`text-caption font-medium ${isOverdue ? 'text-red-600' : 'text-dim'}`}>
                      {isOverdue ? 'Overdue — ' : ''}{dueDateLabel}
                    </span>
                  )}
                  {savingDue && (
                    <div className="w-4 h-4 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
                  )}
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => saveDueDate('')}
                      className="text-xs text-faint hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:ml-auto">
                <button
                  type="button"
                  onClick={sendReminder}
                  disabled={reminding}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-caption font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  {reminding ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Send Reminder to All Guests
                </button>
              </div>
            </div>

            {/* ── Assignees ───────────────────────────────────── */}
            <ProjectAssigneesPanel
              projectId={projectId}
              companyId={companyId}
              currentUserId={userId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
