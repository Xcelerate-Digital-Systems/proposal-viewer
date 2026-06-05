// components/admin/settings/WebhookManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type WebhookEndpoint } from '@/lib/supabase';
import { WEBHOOK_EVENTS, REVIEW_WEBHOOK_EVENTS, type WebhookEvent } from './settings-config';
import WebhookEventCard from './WebhookEventCard';

interface WebhookManagerProps {
  companyId: string;
  events: WebhookEvent[];
}

export default function WebhookManager({ companyId, events }: WebhookManagerProps) {
  const [endpoints, setEndpoints] = useState<Record<string, WebhookEndpoint | null>>({});
  const [loading, setLoading] = useState(true);

  const fetchEndpoints = async () => {
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('company_id', companyId);

    const map: Record<string, WebhookEndpoint | null> = {};
    for (const evt of events) {
      map[evt.key] = (data || []).find((d: WebhookEndpoint) => d.event_type === evt.key) || null;
    }
    setEndpoints(map);
    setLoading(false);
  };

  useEffect(() => { fetchEndpoints(); }, [companyId]);

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-faint" />
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <WebhookEventCard
              key={evt.key}
              eventKey={evt.key}
              label={evt.label}
              description={evt.description}
              icon={evt.icon}
              endpoint={endpoints[evt.key] || null}
              companyId={companyId}
              onRefresh={fetchEndpoints}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted mt-4 px-1">
        Each event can have its own endpoint URL. If a signing secret is set, requests include an <code className="text-muted">X-Webhook-Signature</code> header with an HMAC-SHA256 signature.
      </p>
    </div>
  );
}
