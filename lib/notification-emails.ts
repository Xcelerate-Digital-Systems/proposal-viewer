// lib/notification-emails.ts
// Email content builders and HTML layout templates.

import type { EventType } from './notification-types';

/* ─── Utilities ──────────────────────────────────────────────────────────── */

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Team email builder ─────────────────────────────────────────────────── */

interface TeamEmailParams {
  event_type:       EventType;
  proposalTitle:    string;
  clientName:       string;
  viewerUrl:        string;
  dashboardUrl:     string;
  commentAuthor?:   string;
  commentContent?:  string;
  resolvedBy?:      string;
  feedbackText?:    string;
  feedbackBy?:      string;
}

export function buildTeamEmail(params: TeamEmailParams): { subject: string; html: string } {
  const {
    event_type, proposalTitle, clientName, viewerUrl, dashboardUrl,
    commentAuthor, commentContent, resolvedBy, feedbackText, feedbackBy,
  } = params;

  let subject = '';
  let headline = '';
  let body = '';

  switch (event_type) {
    case 'proposal_viewed':
      subject  = `📋 ${clientName} viewed "${proposalTitle}"`;
      headline = 'Proposal Viewed';
      body     = `<p><strong>${clientName}</strong> just opened your proposal <strong>"${proposalTitle}"</strong> for the first time.</p>`;
      break;

    case 'proposal_accepted':
      subject  = `✅ ${clientName} accepted "${proposalTitle}"`;
      headline = 'Proposal Accepted!';
      body     = `<p><strong>${clientName}</strong> has accepted your proposal <strong>"${proposalTitle}"</strong>.</p>`;
      break;

    case 'proposal_declined':
      subject  = `❌ ${clientName} declined "${proposalTitle}"`;
      headline = 'Proposal Declined';
      body     = `<p><strong>${feedbackBy || clientName}</strong> has declined your proposal <strong>"${proposalTitle}"</strong>.</p>`;
      if (feedbackText) {
        body += `
          <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;margin:16px 0;border-radius:4px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Reason provided</p>
            <p style="margin:0;color:#374151;">${escapeHtml(feedbackText)}</p>
          </div>`;
      }
      break;

    case 'proposal_revision_requested':
      subject  = `✏️ ${clientName} requested changes on "${proposalTitle}"`;
      headline = 'Changes Requested';
      body     = `<p><strong>${feedbackBy || clientName}</strong> reviewed <strong>"${proposalTitle}"</strong> and would like some changes before proceeding.</p>`;
      if (feedbackText) {
        body += `
          <div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Requested changes</p>
            <p style="margin:0;color:#374151;">${escapeHtml(feedbackText)}</p>
          </div>`;
      }
      break;

    case 'comment_added':
      subject  = `💬 New comment on "${proposalTitle}"`;
      headline = 'New Comment';
      body     = `
        <p><strong>${commentAuthor || 'Someone'}</strong> left a comment on <strong>"${proposalTitle}"</strong>:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>`;
      break;

    case 'comment_resolved':
      subject  = `✔️ Comment resolved on "${proposalTitle}"`;
      headline = 'Comment Resolved';
      body     = `<p><strong>${resolvedBy || 'Someone'}</strong> resolved a comment on <strong>"${proposalTitle}"</strong>.</p>`;
      break;
  }

  const html = teamEmailTemplate(headline, body, viewerUrl, dashboardUrl);
  return { subject, html };
}

/* ─── Client email builder ───────────────────────────────────────────────── */

interface ClientEmailParams {
  event_type:       EventType;
  proposalTitle:    string;
  companyName:      string;
  viewerUrl:        string;
  commentAuthor?:   string;
  commentContent?:  string;
  resolvedBy?:      string;
}

export function buildClientEmail(params: ClientEmailParams): { subject: string; html: string } {
  const { event_type, proposalTitle, companyName, viewerUrl, commentAuthor, commentContent, resolvedBy } = params;

  let subject = '';
  let headline = '';
  let body = '';

  switch (event_type) {
    case 'comment_added':
      subject  = `${companyName} replied on "${proposalTitle}"`;
      headline = 'New Reply on Your Proposal';
      body     = `
        <p><strong>${commentAuthor || companyName}</strong> replied on your proposal <strong>"${proposalTitle}"</strong>:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>
        <p>Click below to view the proposal and respond.</p>`;
      break;

    case 'comment_resolved':
      subject  = `Your comment was resolved on "${proposalTitle}"`;
      headline = 'Comment Resolved';
      body     = `<p>Your comment on <strong>"${proposalTitle}"</strong> has been marked as resolved by <strong>${resolvedBy || companyName}</strong>.</p>`;
      break;

    default:
      subject  = `Update on "${proposalTitle}"`;
      headline = 'Proposal Update';
      body     = `<p>There has been an update on your proposal <strong>"${proposalTitle}"</strong>.</p>`;
  }

  const html = clientEmailTemplate(headline, body, viewerUrl, companyName);
  return { subject, html };
}

/* ─── HTML layout templates ──────────────────────────────────────────────── */

function teamEmailTemplate(headline: string, body: string, viewerUrl: string, dashboardUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#043946;padding:20px 32px;">
              <span style="color:#ffffff;font-weight:700;font-size:16px;">AgencyViz</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="padding-right:12px;">
                    <a href="${viewerUrl}" style="display:inline-block;padding:10px 20px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View Proposal</a>
                  </td>
                  <td>
                    <a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#f3f4f6;color:#374151;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">You're receiving this because you have notifications enabled in AgencyViz.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function clientEmailTemplate(headline: string, body: string, viewerUrl: string, companyName: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#043946;padding:20px 32px;">
              <span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(companyName)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td>
                    <a href="${viewerUrl}" style="display:inline-block;padding:10px 20px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View Proposal</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ─── Client decision confirmation email ────────────────────────────────── */

export type ClientDecisionAction = 'accepted' | 'declined' | 'revision_requested';

interface ClientConfirmationParams {
  action:        ClientDecisionAction;
  proposalTitle: string;
  companyName:   string;
  companyLogo:   string | null;
  viewerUrl:     string;
  entityType?:   string;
}

export function buildClientConfirmationEmail(params: ClientConfirmationParams): { subject: string; html: string } {
  const { action, proposalTitle, companyName, companyLogo, viewerUrl, entityType } = params;
  const label = entityType === 'quote' ? 'quote' : 'proposal';

  let subject = '';
  let headline = '';
  let body = '';
  let accentBg = '';

  switch (action) {
    case 'accepted':
      subject  = `Confirmation: You accepted "${proposalTitle}"`;
      headline = `${label.charAt(0).toUpperCase() + label.slice(1)} Accepted`;
      accentBg = '#ecfdf5';
      body     = `
        <div style="background:${accentBg};border-left:3px solid #10b981;padding:12px 16px;margin:0 0 16px;border-radius:4px;">
          <p style="margin:0;color:#065f46;font-size:15px;">You accepted <strong>"${escapeHtml(proposalTitle)}"</strong>.</p>
        </div>
        <p>If you have any questions or need to discuss next steps, please reach out to <strong>${escapeHtml(companyName)}</strong> directly.</p>`;
      break;

    case 'declined':
      subject  = `Confirmation: You declined "${proposalTitle}"`;
      headline = `${label.charAt(0).toUpperCase() + label.slice(1)} Declined`;
      accentBg = '#fef2f2';
      body     = `
        <div style="background:${accentBg};border-left:3px solid #ef4444;padding:12px 16px;margin:0 0 16px;border-radius:4px;">
          <p style="margin:0;color:#991b1b;font-size:15px;">You declined <strong>"${escapeHtml(proposalTitle)}"</strong>.</p>
        </div>
        <p>If you change your mind or would like to discuss alternatives, you can still view the ${label} using the link below.</p>`;
      break;

    case 'revision_requested':
      subject  = `Confirmation: You requested changes on "${proposalTitle}"`;
      headline = 'Changes Requested';
      accentBg = '#fffbeb';
      body     = `
        <div style="background:${accentBg};border-left:3px solid #f59e0b;padding:12px 16px;margin:0 0 16px;border-radius:4px;">
          <p style="margin:0;color:#92400e;font-size:15px;">You requested changes on <strong>"${escapeHtml(proposalTitle)}"</strong>.</p>
        </div>
        <p><strong>${escapeHtml(companyName)}</strong> has been notified and will update the ${label}. You can check back any time using the link below.</p>`;
      break;
  }

  const headerContent = companyLogo
    ? `<img src="${escapeHtml(companyLogo)}" alt="${escapeHtml(companyName)}" style="display:block;max-height:32px;max-width:200px;height:auto;width:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(companyName)}</span>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#043946;padding:20px 32px;">
              ${headerContent}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td>
                    <a href="${viewerUrl}" style="display:inline-block;padding:10px 20px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View ${label.charAt(0).toUpperCase() + label.slice(1)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">This is a confirmation of your response to a ${label} from ${escapeHtml(companyName)}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
