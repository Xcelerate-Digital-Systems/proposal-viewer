import { sendAndLogEmail } from '@/lib/email-log';

function fromEmail(agencyName: string): string {
  const sanitized = agencyName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return `${sanitized} <notifications@agencyviz.io>`;
}

export async function sendAccessInviteEmail(opts: {
  to: string;
  agencyName: string;
  clientName: string | null;
  accessUrl: string;
  notes: string | null;
  companyId: string;
  requestId: string;
}) {
  const greeting = opts.clientName ? `Hi ${opts.clientName}` : 'Hi there';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 16px;">${greeting},</h2>
      <p style="font-size: 15px; color: #333; line-height: 1.6; margin-bottom: 16px;">
        <strong>${opts.agencyName}</strong> needs access to your marketing platforms. Click the button below to securely connect your accounts.
      </p>
      ${opts.notes ? `<p style="font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 16px; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; border-left: 3px solid #017C87;">${opts.notes}</p>` : ''}
      <div style="margin: 24px 0;">
        <a href="${opts.accessUrl}" style="display: inline-block; padding: 12px 28px; background: #017C87; color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
          Grant Access
        </a>
      </div>
      <p style="font-size: 13px; color: #888; margin-top: 24px;">
        This is a secure link. Your login credentials are never shared.
      </p>
    </div>
  `;

  return sendAndLogEmail({
    from: fromEmail(opts.agencyName),
    to: opts.to,
    subject: `${opts.agencyName} needs access to your accounts`,
    html,
    companyId: opts.companyId,
    category: 'client_access_invite',
    entityType: 'client_access_request',
    entityId: opts.requestId,
  });
}

export async function sendAccessGrantedEmail(opts: {
  to: string;
  agencyName: string;
  clientName: string | null;
  platform: string;
  companyId: string;
  requestId: string;
}) {
  const clientLabel = opts.clientName || 'A client';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 16px;">Access Granted</h2>
      <p style="font-size: 15px; color: #333; line-height: 1.6; margin-bottom: 16px;">
        ${clientLabel} has connected their <strong>${opts.platform}</strong> account. You can now manage their account from your dashboard.
      </p>
    </div>
  `;

  return sendAndLogEmail({
    from: fromEmail(opts.agencyName),
    to: opts.to,
    subject: `${clientLabel} connected ${opts.platform}`,
    html,
    companyId: opts.companyId,
    category: 'client_access_granted',
    entityType: 'client_access_request',
    entityId: opts.requestId,
  });
}
