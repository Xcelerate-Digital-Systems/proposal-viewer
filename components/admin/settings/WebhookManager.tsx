// components/admin/settings/WebhookManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Webhook } from 'lucide-react';
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
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center">
          <Webhook size={16} className="text-teal" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Webhooks</h2>
          <p className="text-xs text-faint">Send HTTP POST requests when events occur</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={16} className="animate-spin text-faint" />
        </div>
      ) : (
        <div className={`grid gap-4 ${isSuperAdmin ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-lg'}`}>
          {/* Proposal webhooks */}
          <div className="space-y-3">
            <div className="mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-faint px-1">
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
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint px-1">
                  Creative Review Events
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded">
                  Creative Review
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
