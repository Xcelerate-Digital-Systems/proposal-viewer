// components/admin/settings/WebhookManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type WebhookEndpoint } from '@/lib/supabase';
import { WEBHOOK_EVENTS, REVIEW_WEBHOOK_EVENTS } from './settings-config';
import WebhookEventCard from './WebhookEventCard';

interface WebhookManagerProps {
  companyId: string;
  isSuperAdmin: boolean;
}

export default function WebhookManager({ companyId, isSuperAdmin }: WebhookManagerProps) {
  const [endpoints, setEndpoints] = useState<Record<string, WebhookEndpoint | null>>({});
  const [loading, setLoading] = useState(true);

  const allEvents = isSuperAdmin
    ? [...WEBHOOK_EVENTS, ...REVIEW_WEBHOOK_EVENTS]
    : WEBHOOK_EVENTS;

  const fetchEndpoints = async () => {
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('company_id', companyId);

    const map: Record<string, WebhookEndpoint | null> = {};
    for (const evt of allEvents) {
      map[evt.key] = (data || []).find((d: WebhookEndpoint) => d.event_type === evt.key) || null;
    }
    setEndpoints(map);
    setLoading(false);
  };

  useEffect(() => { fetchEndpoints(); }, [companyId]);

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={16} className="animate-spin text-faint" />
        </div>
      ) : (
        <div className={`grid gap-4 ${isSuperAdmin ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-lg'}`}>
          {/* Proposal webhooks */}
          <div className="space-y-3">
            <div className="mb-1">
              <span className="text-2xs font-semibold uppercase tracking-wider text-faint px-1">
                Proposal Events
              </span>
            </div>
            {WEBHOOK_EVENTS.map((evt) => (
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

          {/* Review webhooks — super admin only */}
          {isSuperAdmin && (
            <div className="space-y-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xs font-semibold uppercase tracking-wider text-faint px-1">
                  Feedback Events
                </span>
                <span className="text-2xs font-semibold uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded">
                  Feedback
                </span>
              </div>
              {REVIEW_WEBHOOK_EVENTS.map((evt) => (
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
        </div>
      )}

      <p className="text-xs text-faint mt-4 px-1">
        Each event can have its own endpoint URL. If a signing secret is set, requests include an <code className="text-muted">X-Webhook-Signature</code> header with an HMAC-SHA256 signature.
      </p>
    </div>
  );
}
