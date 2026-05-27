// lib/billing-emails.ts
// Transactional emails for the Stripe billing lifecycle. Same shape as
// lib/auth-emails.ts so the templates stay consistent across the product.

import { getResend, FROM_EMAIL } from './resend';
import { escapeHtml } from './notification-emails';

type Common = {
  to: string;
  companyName: string;
  manageUrl: string;
};

export async function sendTrialStartedEmail(params: Common & {
  trialEndsAt: string;
  planName: string;
}) {
  const { to, companyName, manageUrl, trialEndsAt, planName } = params;
  const subject = `Your AgencyViz trial has started`;
  const html = trialStartedTemplate({
    companyName: escapeHtml(companyName),
    planName: escapeHtml(planName),
    trialEndsLabel: formatDate(trialEndsAt),
    manageUrl,
  });
  return getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
}

export async function sendTrialEndingEmail(params: Common & {
  trialEndsAt: string;
}) {
  const { to, companyName, manageUrl, trialEndsAt } = params;
  const subject = `Your AgencyViz trial ends in 3 days`;
  const html = trialEndingTemplate({
    companyName: escapeHtml(companyName),
    trialEndsLabel: formatDate(trialEndsAt),
    manageUrl,
  });
  return getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
}

export async function sendPaymentFailedEmail(params: Common & {
  amountLabel: string;
}) {
  const { to, companyName, manageUrl, amountLabel } = params;
  const subject = `We couldn't process your AgencyViz payment`;
  const html = paymentFailedTemplate({
    companyName: escapeHtml(companyName),
    amountLabel: escapeHtml(amountLabel),
    manageUrl,
  });
  return getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
}

export async function sendSubscriptionCanceledEmail(params: Common & {
  endsAt: string | null;
}) {
  const { to, companyName, manageUrl, endsAt } = params;
  const subject = `Your AgencyViz subscription has been canceled`;
  const html = canceledTemplate({
    companyName: escapeHtml(companyName),
    endsLabel: endsAt ? formatDate(endsAt) : null,
    manageUrl,
  });
  return getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
}

/* ── Templates ────────────────────────────────────────────────────────── */

function shell(opts: { title: string; bodyHtml: string }): string {
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
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${opts.title}</h1>
              ${opts.bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
  <tr>
    <td>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#017C87;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${label}</a>
    </td>
  </tr>
</table>`;
}

function trialStartedTemplate(opts: {
  companyName: string;
  planName: string;
  trialEndsLabel: string;
  manageUrl: string;
}) {
  const body = `
<div style="color:#6b7280;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Welcome to <strong>${opts.companyName}</strong>'s 7-day AgencyViz trial on the <strong>${opts.planName}</strong> plan.</p>
  <p style="margin:0;">You won't be charged until <strong>${opts.trialEndsLabel}</strong>. Cancel any time before then from your billing settings.</p>
</div>
${ctaButton(opts.manageUrl, 'Manage subscription')}`;
  return shell({ title: 'Your trial has started', bodyHtml: body });
}

function trialEndingTemplate(opts: {
  companyName: string;
  trialEndsLabel: string;
  manageUrl: string;
}) {
  const body = `
<div style="color:#6b7280;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Your AgencyViz trial for <strong>${opts.companyName}</strong> ends on <strong>${opts.trialEndsLabel}</strong>.</p>
  <p style="margin:0;">After that we'll automatically charge the card on file. If you'd rather not continue, you can cancel any time before the trial ends — no questions asked.</p>
</div>
${ctaButton(opts.manageUrl, 'Manage subscription')}`;
  return shell({ title: 'Your trial ends in 3 days', bodyHtml: body });
}

function paymentFailedTemplate(opts: {
  companyName: string;
  amountLabel: string;
  manageUrl: string;
}) {
  const body = `
<div style="color:#6b7280;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">We weren't able to charge <strong>${opts.amountLabel}</strong> for <strong>${opts.companyName}</strong>'s AgencyViz subscription.</p>
  <p style="margin:0;">Stripe will retry automatically over the next few days. To avoid any interruption, update your payment method now.</p>
</div>
${ctaButton(opts.manageUrl, 'Update payment method')}`;
  return shell({ title: 'Payment failed', bodyHtml: body });
}

function canceledTemplate(opts: {
  companyName: string;
  endsLabel: string | null;
  manageUrl: string;
}) {
  const body = `
<div style="color:#6b7280;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Your AgencyViz subscription for <strong>${opts.companyName}</strong> has been canceled.</p>
  ${opts.endsLabel
    ? `<p style="margin:0;">You'll keep access until <strong>${opts.endsLabel}</strong>. After that your workspace will be paused.</p>`
    : `<p style="margin:0;">Your workspace access has ended. If this was a mistake, you can re-subscribe from your billing settings.</p>`}
</div>
${ctaButton(opts.manageUrl, 'Re-activate subscription')}`;
  return shell({ title: 'Subscription canceled', bodyHtml: body });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
