import { createServiceClient } from '@/lib/supabase-server';
import { isValidWebhookUrl } from '@/lib/sanitize';
import crypto from 'crypto';

type AccessEventType = 'client_access_completed';

export async function fireAccessWebhooks(payload: {
  event_type: AccessEventType;
  company_id: string;
  request: {
    id: string;
    client_name: string | null;
    client_email: string | null;
    share_token: string;
  };
  platforms: Array<{
    platform: string;
    status: string;
    account_name: string | null;
  }>;
}) {
  const supabase = createServiceClient();

  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', payload.company_id)
    .eq('enabled', true)
    .eq('event_type', payload.event_type);

  if (!webhooks || webhooks.length === 0) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event: payload.event_type,
    timestamp: new Date().toISOString(),
    access_request: {
      id: payload.request.id,
      client_name: payload.request.client_name,
      client_email: payload.request.client_email,
      link: `${appUrl}/access/${payload.request.share_token}`,
    },
    platforms: payload.platforms,
  });

  for (const webhook of webhooks) {
    try {
      if (!isValidWebhookUrl(webhook.url)) {
        console.warn(`Skipping access webhook with invalid/private URL: ${webhook.url}`);
        continue;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AgencyViz-Webhooks/1.0',
      };

      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`Access webhook failed for ${webhook.url}:`, err);
    }
  }
}
