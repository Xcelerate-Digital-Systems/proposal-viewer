'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import PlatformStatusBadge from './PlatformStatusBadge';
import { PLATFORM_LABELS, type AccessPlatform, type AccessGrantStatus } from '@/lib/client-access/types';
import { authFetch } from '@/lib/auth-fetch';

interface Grant {
  id: string;
  platform: AccessPlatform;
  status: AccessGrantStatus;
  platform_account_name: string | null;
  error_message: string | null;
}

interface AccessRequest {
  id: string;
  share_token: string;
  platforms: AccessPlatform[];
  status: string;
  client_name: string | null;
  client_email: string | null;
  expires_at: string | null;
  created_at: string;
  grants: Grant[];
}

interface AccessRequestListProps {
  clientId?: string;
  refreshKey?: number;
}

export default function AccessRequestList({ clientId, refreshKey }: AccessRequestListProps) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const confirm = useConfirm();

  const fetchRequests = useCallback(async () => {
    try {
      const url = clientId
        ? `/api/client-access?client_id=${clientId}`
        : '/api/client-access';
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshKey]);

  const copyLink = async (shareToken: string, requestId: string) => {
    const url = `${window.location.origin}/access/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(requestId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteRequest = async (id: string) => {
    const ok = await confirm({
      title: 'Delete access request?',
      message: 'This will permanently remove this access request and all associated grant data. This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await authFetch(`/api/client-access/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  if (loading) {
    return <div className="text-sm text-dim py-4">Loading access requests…</div>;
  }

  if (requests.length === 0) {
    return <div className="text-sm text-dim py-4">No access requests yet.</div>;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const isExpired = request.expires_at && new Date(request.expires_at) < new Date();

        return (
          <div
            key={request.id}
            className={`rounded-xl border border-edge p-4 transition-colors ${isExpired ? 'opacity-50' : 'bg-surface'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink truncate">
                    {request.client_name || request.client_email || 'Unnamed'}
                  </span>
                  {isExpired && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-100">Expired</span>
                  )}
                </div>
                <div className="text-xs text-dim mt-0.5">
                  Created {new Date(request.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!isExpired && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label="Copy link"
                      onClick={() => copyLink(request.share_token, request.id)}
                      leftIcon={copiedId === request.id ? Check : Copy}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label="Open link"
                      onClick={() => window.open(`/access/${request.share_token}`, '_blank')}
                      leftIcon={ExternalLink}
                    />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Delete"
                  onClick={() => deleteRequest(request.id)}
                  leftIcon={Trash2}
                />
              </div>
            </div>

            {/* Platform grant statuses */}
            <div className="flex flex-wrap gap-2 mt-3">
              {request.grants.map((grant) => (
                <div key={grant.id} className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 border border-edge">
                  <span className="text-[11px] text-dim">
                    {PLATFORM_LABELS[grant.platform].split('(')[0].trim()}
                  </span>
                  <PlatformStatusBadge status={grant.status} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
