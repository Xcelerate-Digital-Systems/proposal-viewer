import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: members } = await supabase
    .from('team_members')
    .select('id, user_id, is_super_admin')
    .eq('user_id', user.id)
    .eq('is_super_admin', true)
    .limit(1);
  return members?.[0] ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await verifySuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = createServiceClient();

    const [
      { count: totalAccounts },
      { data: subscriptions },
      { count: openTickets },
      { data: recentSignups },
    ] = await Promise.all([
      supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'agency'),
      supabase
        .from('subscriptions')
        .select('status, billing_cycle, plans(monthly_price_cents, yearly_price_cents, slug)'),
      supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']),
      supabase
        .from('companies')
        .select('id, name, created_at')
        .eq('account_type', 'agency')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    let activeSubscriptions = 0;
    let trialingAccounts = 0;
    let lifetimeAccounts = 0;
    let mrrCents = 0;

    for (const sub of (subscriptions ?? []) as unknown as {
      status: string;
      billing_cycle: string | null;
      plans: { monthly_price_cents: number; yearly_price_cents: number; slug: string } | null;
    }[]) {
      if (sub.status === 'active') {
        activeSubscriptions++;
        const plan = sub.plans;
        if (plan?.slug === 'lifetime') {
          lifetimeAccounts++;
        } else if (plan) {
          if (sub.billing_cycle === 'yearly') {
            mrrCents += Math.round((plan.yearly_price_cents || 0) / 12);
          } else {
            mrrCents += plan.monthly_price_cents || 0;
          }
        }
      } else if (sub.status === 'trialing') {
        trialingAccounts++;
      }
    }

    return NextResponse.json({
      totalAccounts: totalAccounts ?? 0,
      activeSubscriptions,
      trialingAccounts,
      lifetimeAccounts,
      mrrCents,
      openTickets: openTickets ?? 0,
      recentSignups: recentSignups ?? [],
    });
  } catch (err) {
    console.error('[admin/metrics] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
