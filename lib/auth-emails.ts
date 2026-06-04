// lib/auth-emails.ts
// Email content + sending for auth flows (team invites, etc).

import { FROM_EMAIL } from './resend';
import { sendAndLogEmail } from './email-log';
import { escapeHtml } from './notification-emails';

interface InviteEmailParams {
  to: string;
  companyName: string;
  companyId?: string;
  inviterName: string;
  role: 'owner' | 'admin' | 'member';
  inviteUrl: string;
  expiresAt: string;
}

export async function sendInviteEmail(params: InviteEmailParams) {
  const { to, companyName, companyId, inviterName, role, inviteUrl, expiresAt } = params;
  const expiryLabel = new Date(expiresAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const subject = `${inviterName} invited you to join ${companyName} on AgencyViz`;
  const html = inviteEmailTemplate({
    companyName: escapeHtml(companyName),
    inviterName: escapeHtml(inviterName),
    role,
    inviteUrl,
    expiryLabel,
  });

  return sendAndLogEmail({ from: FROM_EMAIL, to, subject, html, companyId, category: 'auth', eventType: 'invite' });
}

interface ResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(params: ResetEmailParams) {
  const { to, resetUrl } = params;
  const subject = 'Reset your AgencyViz password';
  const html = resetEmailTemplate({ resetUrl });
  return sendAndLogEmail({ from: FROM_EMAIL, to, subject, html, category: 'auth', eventType: 'password_reset' });
}

interface WelcomeEmailParams {
  to: string;
  firstName: string;
  companyName: string;
  companyId?: string;
  appUrl: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const { to, firstName, companyName, companyId, appUrl } = params;
  const subject = `Welcome to AgencyViz, ${firstName}`;
  const html = welcomeEmailTemplate({
    firstName: escapeHtml(firstName),
    companyName: escapeHtml(companyName),
    appUrl,
  });
  return sendAndLogEmail({ from: FROM_EMAIL, to, subject, html, companyId, category: 'auth', eventType: 'welcome' });
}

function resetEmailTemplate(opts: { resetUrl: string }) {
  const { resetUrl } = opts;
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
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">Reset your password</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px;">We received a request to reset the password for your AgencyViz account.</p>
                <p style="margin:0;">Click the button below to choose a new password. This link expires in 1 hour.</p>
              </div>
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td>
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">If the button doesn't work, copy this link into your browser:<br><span style="color:#6b7280;word-break:break-all;">${resetUrl}</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomeEmailTemplate(opts: {
  firstName: string;
  companyName: string;
  appUrl: string;
}) {
  const { firstName, companyName, appUrl } = opts;
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
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">Welcome aboard, ${firstName}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px;">Your workspace <strong>${companyName}</strong> is live. Three things most agencies do in the first hour:</p>
                <ol style="margin:0 0 16px;padding-left:18px;">
                  <li style="margin-bottom:8px;">Drop your branding into <strong>Settings → Branding</strong> so every proposal, document, and review goes out in your colours.</li>
                  <li style="margin-bottom:8px;">Invite your team from <strong>Settings → Members</strong>.</li>
                  <li>Spin up your first proposal or feedback project from the dashboard.</li>
                </ol>
                <p style="margin:0;">Hit reply if you get stuck — a real human reads it.</p>
              </div>
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td>
                    <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open AgencyViz</a>
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

function inviteEmailTemplate(opts: {
  companyName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiryLabel: string;
}) {
  const { companyName, inviterName, role, inviteUrl, expiryLabel } = opts;
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
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">You're invited to join ${companyName}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px;"><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on AgencyViz as <strong style="text-transform:capitalize;">${role}</strong>.</p>
                <p style="margin:0;">Click below to set up your account. This invite expires on <strong>${expiryLabel}</strong>.</p>
              </div>
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td>
                    <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Accept Invite</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">If the button doesn't work, copy this link into your browser:<br><span style="color:#6b7280;word-break:break-all;">${inviteUrl}</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">If you weren't expecting this invite, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
