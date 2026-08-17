import { sendAndLogEmail } from '@/lib/email-log';
import { fromEmail } from '@/lib/resend';

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
    subject: `${opts.agencyName} — access request`,
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

export async function sendAccessCompletedEmail(opts: {
  to: string;
  agencyName: string;
  clientName: string | null;
  clientEmail: string | null;
  platforms: Array<{ platform: string; status: string; accountName: string | null }>;
  companyId: string;
  requestId: string;
}) {
  const clientLabel = opts.clientName || opts.clientEmail || 'A client';
  const platformRows = opts.platforms
    .map((p) => `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 14px;">${p.platform}</td><td style="padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 14px;">${p.accountName || '—'}</td><td style="padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #017C87;">${p.status}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 16px;">All Access Granted</h2>
      <p style="font-size: 15px; color: #333; line-height: 1.6; margin-bottom: 16px;">
        <strong>${clientLabel}</strong> has finished connecting all requested platforms.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead><tr style="background: #f9f9f9;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Platform</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Account</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Status</th>
        </tr></thead>
        <tbody>${platformRows}</tbody>
      </table>
    </div>
  `;

  return sendAndLogEmail({
    from: fromEmail(opts.agencyName),
    to: opts.to,
    subject: `${clientLabel} — all access granted`,
    html,
    companyId: opts.companyId,
    category: 'client_access_completed',
    entityType: 'client_access_request',
    entityId: opts.requestId,
  });
}

export async function sendAccessExpiryReminderEmail(opts: {
  to: string;
  agencyName: string;
  clientName: string | null;
  clientEmail: string | null;
  accessUrl: string;
  expiresAt: string;
  pendingPlatforms: string[];
  companyId: string;
  requestId: string;
}) {
  const clientLabel = opts.clientName || opts.clientEmail || 'Your client';
  const expDate = new Date(opts.expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const platformList = opts.pendingPlatforms.map((p) => `<li style="margin-bottom: 4px;">${p}</li>`).join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 16px;">Access Request Expiring Soon</h2>
      <p style="font-size: 15px; color: #333; line-height: 1.6; margin-bottom: 16px;">
        The access request for <strong>${clientLabel}</strong> expires on <strong>${expDate}</strong> and still has platforms pending:
      </p>
      <ul style="font-size: 14px; color: #555; line-height: 1.8; margin-bottom: 20px; padding-left: 20px;">${platformList}</ul>
      <p style="font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 16px;">
        You may want to send them a reminder or create a new request.
      </p>
      <div style="margin: 24px 0;">
        <a href="${opts.accessUrl}" style="display: inline-block; padding: 10px 24px; background: #017C87; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
          View Request
        </a>
      </div>
    </div>
  `;

  return sendAndLogEmail({
    from: fromEmail(opts.agencyName),
    to: opts.to,
    subject: `Access request for ${clientLabel} expiring soon`,
    html,
    companyId: opts.companyId,
    category: 'client_access_expiry',
    entityType: 'client_access_request',
    entityId: opts.requestId,
  });
}
