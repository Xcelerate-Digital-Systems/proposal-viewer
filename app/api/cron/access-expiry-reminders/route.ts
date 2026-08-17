import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { sendAccessExpiryReminderEmail } from '@/lib/client-access/emails';
import { PLATFORM_LABELS, type AccessPlatform } from '@/lib/client-access/types';

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

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io').replace(/\/+$/, '');

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const { data: expiringRequests } = await supabase
    .from('client_access_requests')
    .select('id, company_id, share_token, client_name, client_email, expires_at, last_expiry_reminder_at')
    .in('status', ['pending', 'partial'])
    .not('expires_at', 'is', null)
    .lte('expires_at', in48h)
    .gt('expires_at', now.toISOString());

  if (!expiringRequests?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const req of expiringRequests) {
    if (req.last_expiry_reminder_at) {
      const lastSent = new Date(req.last_expiry_reminder_at).getTime();
      if (now.getTime() - lastSent < 24 * 60 * 60 * 1000) continue;
    }

    const { data: grants } = await supabase
      .from('client_access_grants')
      .select('platform, status')
      .eq('request_id', req.id)
      .in('status', ['pending', 'oauth_complete', 'failed']);

    if (!grants?.length) continue;

    const pendingPlatforms = grants.map((g) =>
      PLATFORM_LABELS[g.platform as AccessPlatform] || g.platform,
    );

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', req.company_id)
      .single();

    const { data: owner } = await supabase
      .from('team_members')
      .select('email')
      .eq('company_id', req.company_id)
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (!owner?.email || !company?.name) continue;

    try {
      await sendAccessExpiryReminderEmail({
        to: owner.email,
        agencyName: company.name,
        clientName: req.client_name,
        clientEmail: req.client_email,
        accessUrl: `${appUrl}/access/${req.share_token}`,
        expiresAt: req.expires_at!,
        pendingPlatforms,
        companyId: req.company_id,
        requestId: req.id,
      });

      await supabase
        .from('client_access_requests')
        .update({ last_expiry_reminder_at: now.toISOString() })
        .eq('id', req.id);

      sent++;
    } catch (err) {
      console.error(`[access-expiry-reminders] Failed for request ${req.id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
