import { createServiceClient } from '@/lib/supabase-server';
import { fireAccessWebhooks } from './fire-webhooks';
import { sendAccessCompletedEmail } from './emails';
import { PLATFORM_LABELS, type AccessPlatform } from './types';

export async function notifyAccessCompletion(opts: {
  requestId: string;
  companyId: string;
}) {
  const supabase = createServiceClient();

  const { data: reqInfo } = await supabase
    .from('client_access_requests')
    .select('id, client_name, client_email, share_token')
    .eq('id', opts.requestId)
    .single();

  if (!reqInfo) return;

  const { data: grantList } = await supabase
    .from('client_access_grants')
    .select('platform, status, platform_account_name')
    .eq('request_id', opts.requestId);

  const grants = (grantList ?? []).map((g) => ({
    platform: PLATFORM_LABELS[g.platform as AccessPlatform] || g.platform,
    status: g.status,
    account_name: g.platform_account_name,
  }));

  fireAccessWebhooks({
    event_type: 'client_access_completed',
    company_id: opts.companyId,
    request: reqInfo,
    platforms: grants,
  }).catch((err) => console.error('[notify-completion] webhook error:', err));

  const emailPlatforms = grants.map((g) => ({
    platform: g.platform,
    status: g.status,
    accountName: g.account_name,
  }));

  try {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', opts.companyId)
      .single();

    const { data: owner } = await supabase
      .from('team_members')
      .select('email')
      .eq('company_id', opts.companyId)
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (owner?.email && company?.name) {
      await sendAccessCompletedEmail({
        to: owner.email,
        agencyName: company.name,
        clientName: reqInfo.client_name,
        clientEmail: reqInfo.client_email,
        platforms: emailPlatforms,
        companyId: opts.companyId,
        requestId: opts.requestId,
      });
    }
  } catch (err) {
    console.error('[notify-completion] email error:', err);
  }
}
