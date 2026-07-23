// app/api/cron/review-reminders/route.ts
//
// Daily cron: sends automated reminder emails for stage deadlines that are
// due within 24 hours or already overdue. Uses last_stage_reminder_at to
// avoid re-notifying the same project within a 24h window.
//
// Triggered daily by Vercel cron (see vercel.json). Auth via CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { fromEmail } from '@/lib/resend';
import { sendAndLogEmail } from '@/lib/email-log';
import { buildReviewUrl } from '@/lib/proposal-url';
import {
  escapeHtml,
  type EmailBranding,
} from '@/lib/review-notification-emails';
import { buildUnsubscribeUrl } from '@/lib/feedback/unsubscribe-token';
import { REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

// ─── Email builder ──────────────────────────────────────────────────────

function buildStageReminderEmail(params: {
  branding: EmailBranding;
  projectTitle: string;
  reviewUrl: string;
  stages: { label: string; dueDate: string; isOverdue: boolean }[];
  recipientName: string | null;
}): { subject: string; html: string } {
  const { branding, projectTitle, reviewUrl, stages, recipientName } = params;

  const overdueCount = stages.filter((s) => s.isOverdue).length;
  const subject = overdueCount > 0
    ? `Overdue: Stage deadline${stages.length > 1 ? 's' : ''} on "${projectTitle}"`
    : `Reminder: Stage deadline${stages.length > 1 ? 's' : ''} approaching on "${projectTitle}"`;

  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi,';

  const stageRows = stages.map((s) => {
    const dateLabel = new Date(s.dueDate + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    const color = s.isOverdue ? '#ef4444' : '#f59e0b';
    const badge = s.isOverdue ? 'OVERDUE' : 'DUE SOON';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
        <strong style="color:#111827;">${escapeHtml(s.label)}</strong>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${dateLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:${color};">${badge}</span>
      </td>
    </tr>`;
  }).join('');

  const accentBg = (() => {
    // Use branding import helpers from the email module — but since we can't
    // import the private headerBg(), just inline a dark version.
    return '#1a1a2e';
  })();

  const headerInner = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.companyName)}" style="display:block;max-height:32px;max-width:200px;height:auto;width:auto;border:0;" />`
    : `<span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(branding.companyName)}</span>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${accentBg};padding:18px 32px;">${headerInner}</td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:600;">Stage deadline reminder</h1>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">${greeting}</p>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
            The following stage${stages.length > 1 ? 's' : ''} in <strong>"${escapeHtml(projectTitle)}"</strong>
            ${overdueCount > 0 ? (overdueCount === stages.length ? 'are overdue' : 'need your attention') : 'are due soon'}:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 24px;">
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Stage</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Due</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Status</th>
            </tr>
            ${stageRows}
          </table>
          <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:${escapeHtml(branding.accentColor)};color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Open project</a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">You're receiving this because you're assigned to a stage with an upcoming deadline.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

// ─── Handler ────────────────────────────────────────────────────────────

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const now = new Date();

  // Find projects with stage_due_dates that haven't been reminded in 24h.
  // We pull all projects with non-empty stage_due_dates and filter in JS
  // because Postgres JSONB queries for "any value within 24h" are complex.
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: projects, error } = await supabase
    .from('review_projects')
    .select('id, title, company_id, share_token, stage_due_dates, last_stage_reminder_at, status')
    .neq('stage_due_dates', '{}')
    .not('status', 'in', '("archived","rejected")')
    .or(`last_stage_reminder_at.is.null,last_stage_reminder_at.lt.${twentyFourHoursAgo}`)
    .limit(200);

  if (error) {
    console.error('review-reminders: query failed', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ projects: 0, sent: 0 });
  }

  // Filter to projects with at least one stage due within 24h or overdue.
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-');

  const todayDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  type ProjectRow = typeof projects[0];
  type DueStage = { stage: string; label: string; dueDate: string; isOverdue: boolean };

  const eligibleProjects: { project: ProjectRow; dueStages: DueStage[] }[] = [];

  for (const p of projects) {
    const dates = (p.stage_due_dates ?? {}) as Record<string, string>;
    const dueStages: DueStage[] = [];

    for (const [stage, dateStr] of Object.entries(dates)) {
      if (!dateStr) continue;
      // Stage is due within 24h (today or tomorrow) or already overdue
      const isOverdue = dateStr < todayDate;
      const isDueSoon = dateStr >= todayDate && dateStr <= tomorrowDate;

      if (isOverdue || isDueSoon) {
        const config = REVIEW_STATUS_CONFIG[stage as keyof typeof REVIEW_STATUS_CONFIG];
        dueStages.push({
          stage,
          label: config?.label ?? stage,
          dueDate: dateStr,
          isOverdue,
        });
      }
    }

    if (dueStages.length > 0) {
      eligibleProjects.push({ project: p, dueStages });
    }
  }

  if (eligibleProjects.length === 0) {
    return NextResponse.json({ projects: 0, sent: 0 });
  }

  // Cache company branding
  const companyCache = new Map<string, EmailBranding & { customDomain: string | null; domainVerified: boolean }>();

  let totalSent = 0;

  for (const { project, dueStages } of eligibleProjects) {
    // Load company branding
    let company = companyCache.get(project.company_id);
    if (!company) {
      const { data: c } = await supabase
        .from('companies')
        .select('name, logo_path, accent_color, custom_domain, domain_verified')
        .eq('id', project.company_id)
        .maybeSingle();
      const logoUrl = c?.logo_path
        ? supabase.storage.from('company-assets').getPublicUrl(c.logo_path as string).data.publicUrl
        : null;
      company = {
        companyName: c?.name || 'Your agency',
        accentColor: (c?.accent_color as string) || '#017C87',
        logoUrl,
        customDomain: (c?.custom_domain as string | null) ?? null,
        domainVerified: !!c?.domain_verified,
      };
      companyCache.set(project.company_id, company);
    }

    const verifiedDomain = company.domainVerified ? company.customDomain : null;
    const reviewUrl = buildReviewUrl(project.share_token, verifiedDomain, appUrl);
    const branding: EmailBranding = {
      companyName: company.companyName,
      accentColor: company.accentColor,
      logoUrl: company.logoUrl,
    };

    // Collect all assignees for the due stages.
    const dueStageNames = dueStages.map((s) => s.stage);

    // Team members assigned to these stages
    const { data: stageAssignees } = await supabase
      .from('review_project_stage_assignees')
      .select('team_member_id, stages')
      .eq('review_project_id', project.id);

    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, email, name')
      .eq('company_id', project.company_id);

    const teamEmailMap = new Map<string, { email: string; name: string | null }>();
    for (const m of (teamMembers ?? []) as { id: string; email: string; name: string | null }[]) {
      teamEmailMap.set(m.id, { email: m.email, name: m.name });
    }

    const recipientEmails = new Set<string>();
    const recipientNames = new Map<string, string | null>();

    for (const a of (stageAssignees ?? []) as { team_member_id: string; stages: string[] }[]) {
      const hasOverlap = a.stages.some((s: string) => dueStageNames.includes(s));
      if (!hasOverlap) continue;
      const member = teamEmailMap.get(a.team_member_id);
      if (member) {
        recipientEmails.add(member.email.toLowerCase());
        recipientNames.set(member.email.toLowerCase(), member.name);
      }
    }

    // Guests assigned to these stages
    const { data: guestAssignees } = await supabase
      .from('review_project_guest_recipients')
      .select('email, name, stages, removed_at, notify_status')
      .eq('review_project_id', project.id)
      .is('removed_at', null);

    for (const g of (guestAssignees ?? []) as { email: string; name: string | null; stages: string[]; removed_at: string | null; notify_status: boolean }[]) {
      if (g.notify_status === false) continue;
      const hasOverlap = (g.stages ?? []).some((s: string) => dueStageNames.includes(s));
      if (!hasOverlap && (g.stages ?? []).length > 0) continue;
      recipientEmails.add(g.email.toLowerCase());
      recipientNames.set(g.email.toLowerCase(), g.name);
    }

    if (recipientEmails.size === 0) continue;

    // Send one email per recipient
    for (const email of Array.from(recipientEmails)) {
      try {
        const { subject, html } = buildStageReminderEmail({
          branding,
          projectTitle: project.title,
          reviewUrl,
          stages: dueStages,
          recipientName: recipientNames.get(email) ?? null,
        });

        const unsub = buildUnsubscribeUrl(appUrl, project.id, email);
        const finalHtml = html.replace(
          '</body>',
          `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:0 20px 20px;"><tr><td align="center"><p style="margin:0;color:#9ca3af;font-size:11px;"><a href="${escapeHtml(unsub)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from this project</a></p></td></tr></table></body>`,
        );

        await sendAndLogEmail({
          from: fromEmail(branding.companyName),
          to: email,
          subject,
          html: finalHtml,
          companyId: project.company_id,
          category: 'campaign_notification',
          eventType: 'stage_deadline_reminder',
          entityType: 'campaign',
          entityId: project.id,
        });
        totalSent++;
      } catch (err) {
        console.error(`review-reminders: failed to email ${email}:`, err);
      }
    }

    // Mark this project as reminded
    await supabase
      .from('review_projects')
      .update({ last_stage_reminder_at: now.toISOString() })
      .eq('id', project.id);
  }

  return NextResponse.json({
    projects: eligibleProjects.length,
    sent: totalSent,
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
