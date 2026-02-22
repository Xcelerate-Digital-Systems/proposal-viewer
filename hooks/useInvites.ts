// hooks/useInvites.ts
'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type CompanyInvite = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invited_by_member?: { name: string };
};

export function useInvites(companyId?: string) {
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    };
  };

  const buildUrl = (path: string) => {
    if (companyId) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}company_id=${companyId}`;
    }
    return path;
  };

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildUrl('/api/invites'), { headers });
      const data = await res.json();
      if (res.ok) {
        setInvites(data.invites || []);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const createInvite = async (email: string, role: 'admin' | 'member' = 'member') => {
    const headers = await getAuthHeaders();
    const res = await fetch(buildUrl('/api/invites'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error, data: null };
    }
    // Refresh the list
    await fetchInvites();
    return { error: null, data };
  };

  const revokeInvite = async (inviteId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(buildUrl(`/api/invites/${inviteId}`), {
      method: 'DELETE',
      headers,
    });
    if (res.ok) {
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    }
    return { error: res.ok ? null : 'Failed to revoke invite' };
  };

  const pendingInvites = invites.filter(
    i => !i.accepted_at && new Date(i.expires_at) > new Date()
  );

  const acceptedInvites = invites.filter(i => !!i.accepted_at);

  const expiredInvites = invites.filter(
    i => !i.accepted_at && new Date(i.expires_at) <= new Date()
  );

  return {
    invites,
    pendingInvites,
    acceptedInvites,
    expiredInvites,
    loading,
    fetchInvites,
    createInvite,
    revokeInvite,
  };
}