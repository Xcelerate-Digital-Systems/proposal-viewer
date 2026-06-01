// app/api/settings/connected-apps/route.ts
//
// Lists and disconnects integrations that obtained an access token via an
// OAuth flow (Chrome extension, Looker Studio connector, future OAuth
// clients). These tokens live in the same api_keys table as user-managed
// keys but are filtered out of Settings → API Keys; here we group them by
// (source, label, user) so a single disconnect action revokes the right set.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type Source = 'oauth_extension' | 'oauth_client';
const OAUTH_SOURCES: Source[] = ['oauth_extension', 'oauth_client'];

interface ConnectedApp {
  source: Source;
  label: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  connected_at: string;       // oldest active row → first connection
  last_used_at: string | null; // most recent activity across the group
  token_count: number;        // > 1 only when the dedup-on-reauth path was bypassed somehow
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('source, label, user_id, created_at, last_used_at')
      .eq('company_id', auth.companyId)
      .in('source', OAUTH_SOURCES)
      .is('revoked_at', null);

    if (error) {
      console.error('[api/settings/connected-apps] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Group by (source, label, user_id) so each connected integration shows up
    // once. token_count > 1 surfaces stale rows worth investigating.
    const groups = new Map<string, ConnectedApp>();
    for (const k of keys ?? []) {
      const key = `${k.source}|${k.label}|${k.user_id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.token_count += 1;
        if (k.created_at < existing.connected_at) existing.connected_at = k.created_at;
        if (k.last_used_at && (!existing.last_used_at || k.last_used_at > existing.last_used_at)) {
          existing.last_used_at = k.last_used_at;
        }
      } else {
        groups.set(key, {
          source: k.source as Source,
          label: k.label,
          user_id: k.user_id,
          user_name: null,
          user_email: null,
          connected_at: k.created_at,
          last_used_at: k.last_used_at,
          token_count: 1,
        });
      }
    }

    // Hydrate user_name/email for the users involved. Scoped to this company
    // so we don't expose memberships in other workspaces.
    const grouped = Array.from(groups.values());
    const userIds = Array.from(new Set(grouped.map((g) => g.user_id)));
    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, name, email')
        .eq('company_id', auth.companyId)
        .in('user_id', userIds);
      const byUser = new Map<string, { name: string | null; email: string | null }>(
        (members ?? []).map((m) => [m.user_id, { name: m.name ?? null, email: m.email ?? null }]),
      );
      for (const g of grouped) {
        const m = byUser.get(g.user_id);
        if (m) {
          g.user_name = m.name;
          g.user_email = m.email;
        }
      }
    }

    const data = grouped.sort(
      (a, b) => (b.last_used_at ?? b.connected_at).localeCompare(a.last_used_at ?? a.connected_at),
    );

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[api/settings/connected-apps] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Disconnect = revoke every active token in the group identified by
// (source, label, user_id). The client will re-authorize the next time it
// tries to use the API.
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const source = req.nextUrl.searchParams.get('source');
    const label = req.nextUrl.searchParams.get('label');
    const userId = req.nextUrl.searchParams.get('user_id');

    if (!source || !label || !userId) {
      return NextResponse.json(
        { error: 'source, label and user_id are required' },
        { status: 400 },
      );
    }
    if (source !== 'oauth_extension' && source !== 'oauth_client') {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    // Only owners/admins can disconnect another user's integration; everyone
    // can disconnect their own.
    const isAdmin = auth.member.role === 'owner' || auth.member.role === 'admin';
    if (userId !== auth.member.user_id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('company_id', auth.companyId)
      .eq('user_id', userId)
      .eq('source', source)
      .eq('label', label)
      .is('revoked_at', null);

    if (error) {
      console.error('[api/settings/connected-apps] DELETE:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/settings/connected-apps] DELETE:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
