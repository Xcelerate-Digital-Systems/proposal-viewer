// app/api/cron/meta-api-health/route.ts
//
// Weekly health check for the Meta Graph API version pinned by the connector.
// Detects: version still active, newer versions available, deprecation signals.
// Emails the admin when the status changes to something actionable.
//
// Triggered weekly by Vercel cron (see vercel.json).

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { sendAndLogEmail } from '@/lib/email-log';
import { FROM_EMAIL } from '@/lib/resend';
import { META_API_VERSION } from '@/lib/connectors/meta/fields';

export const dynamic = 'force-dynamic';

const NOTIFY_EMAIL = 'jack@xceleratedigitalsystems.com.au';

type HealthStatus = 'healthy' | 'upgrade_available' | 'deprecated' | 'error';

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

function appAccessToken(): string | null {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) return null;
  return `${id}|${secret}`;
}

async function checkVersion(version: string, token: string): Promise<{ ok: boolean; actualVersion: string | null; headers: Record<string, string> }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/facebook?fields=id,name&access_token=${token}`,
      { cache: 'no-store' },
    );
    const actualVersion = res.headers.get('facebook-api-version') || null;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { ok: res.ok, actualVersion, headers };
  } catch {
    return { ok: false, actualVersion: null, headers: {} };
  }
}

async function findLatestVersion(token: string, currentMajor: number): Promise<string | null> {
  let latest: string | null = null;
  for (let v = currentMajor + 1; v <= currentMajor + 5; v++) {
    const { ok } = await checkVersion(`v${v}.0`, token);
    if (ok) {
      latest = `v${v}.0`;
    } else {
      break;
    }
  }
  return latest;
}

function buildAlertEmail(status: HealthStatus, pinned: string, latest: string | null, details: Record<string, unknown>): { subject: string; html: string } {
  const statusLabels: Record<HealthStatus, string> = {
    healthy: 'Healthy',
    upgrade_available: 'Upgrade Available',
    deprecated: 'Deprecated — Action Required',
    error: 'Check Failed',
  };

  const subject = `Meta API Health: ${statusLabels[status]} (${pinned})`;

  const rows = [
    ['Pinned Version', pinned],
    ['Status', statusLabels[status]],
    ...(latest ? [['Latest Available', latest]] : []),
    ...(details.actualVersion ? [['Actual Version Served', String(details.actualVersion)]] : []),
    ...(details.error ? [['Error', String(details.error)]] : []),
  ];

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #043946; font-size: 18px; margin-bottom: 16px;">Meta Graph API Version Check</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; white-space: nowrap;">${label}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 500;">${value}</td>
          </tr>
        `).join('')}
      </table>
      ${status === 'deprecated' ? `
        <div style="margin-top: 20px; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;">
            <strong>Action required:</strong> The pinned version <code>${pinned}</code> is deprecated or no longer responding.
            Update <code>META_API_VERSION</code> in <code>lib/connectors/meta/fields.ts</code> to ${latest || 'the latest available version'}.
          </p>
        </div>
      ` : ''}
      ${status === 'upgrade_available' ? `
        <div style="margin-top: 20px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            <strong>Heads up:</strong> Meta has released <code>${latest}</code>. Consider upgrading from <code>${pinned}</code>
            before the current version reaches end-of-life.
          </p>
        </div>
      ` : ''}
      <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
        Sent by the AgencyViz Meta API health check cron.
      </p>
    </div>
  `.trim();

  return { subject, html };
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = appAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: 'META_APP_ID or META_APP_SECRET not configured' },
      { status: 500 },
    );
  }

  const currentMajor = parseInt(META_API_VERSION.replace('v', '').split('.')[0], 10);

  const pinnedCheck = await checkVersion(META_API_VERSION, token);
  const latestVersion = await findLatestVersion(token, currentMajor);

  let status: HealthStatus;
  const details: Record<string, unknown> = {
    actualVersion: pinnedCheck.actualVersion,
    pinnedResponded: pinnedCheck.ok,
  };

  if (!pinnedCheck.ok) {
    status = 'deprecated';
    details.error = 'Pinned version returned a non-200 response';
  } else if (pinnedCheck.actualVersion && pinnedCheck.actualVersion !== META_API_VERSION) {
    // Meta silently upgraded us — our version is no longer served
    status = 'deprecated';
    details.error = `Requested ${META_API_VERSION} but Meta served ${pinnedCheck.actualVersion}`;
  } else if (latestVersion) {
    status = 'upgrade_available';
  } else {
    status = 'healthy';
  }

  if (latestVersion) details.latestVersion = latestVersion;

  const supabase = createServiceClient();

  // Upsert the health row
  const { error: upsertError } = await supabase
    .from('integration_health')
    .upsert(
      {
        connector: 'meta',
        pinned_version: META_API_VERSION,
        latest_version: latestVersion,
        status,
        details,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'connector' },
    );

  if (upsertError) {
    console.error('integration_health upsert failed:', upsertError);
  }

  // Email if status is actionable and we haven't notified recently (7-day cooldown)
  if (status !== 'healthy') {
    const { data: existing } = await supabase
      .from('integration_health')
      .select('notified_at')
      .eq('connector', 'meta')
      .single();

    const lastNotified = existing?.notified_at ? new Date(existing.notified_at) : null;
    const cooldownMs = 7 * 24 * 60 * 60 * 1000;
    const shouldNotify = !lastNotified || Date.now() - lastNotified.getTime() > cooldownMs;

    if (shouldNotify) {
      try {
        const { subject, html } = buildAlertEmail(status, META_API_VERSION, latestVersion, details);
        await sendAndLogEmail({
          from: FROM_EMAIL,
          to: NOTIFY_EMAIL,
          subject,
          html,
          category: 'integration_health',
          eventType: `meta_api_${status}`,
          entityType: 'integration',
        });

        await supabase
          .from('integration_health')
          .update({ notified_at: new Date().toISOString() })
          .eq('connector', 'meta');
      } catch (err) {
        console.error('Health check notification failed:', err);
      }
    }
  }

  return NextResponse.json({
    connector: 'meta',
    pinned: META_API_VERSION,
    latest: latestVersion,
    status,
    details,
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
