// app/api/admin/accounts/[id]/subscription/route.ts
//
// Super-admin-only route for granting / revoking lifetime subscriptions.
//
// POST /api/admin/accounts/:id/subscription   → grant lifetime access
// DELETE /api/admin/accounts/:id/subscription → revoke lifetime access

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getPlanBySlug } from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.member.is_super_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: companyId } = await params;
    const supabase = createServiceClient();

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const plan = await getPlanBySlug('lifetime');
    if (!plan) {
      return NextResponse.json(
        { error: 'Lifetime plan not found. Run the lifetime-plan-migration.sql first.' },
        { status: 500 },
      );
    }

    const { error } = await supabase.from('subscriptions').upsert(
      {
        company_id: companyId,
        plan_id: plan.id,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        status: 'active',
        billing_cycle: null,
        trial_ends_at: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' },
    );

    if (error) {
      console.error('[admin/subscription] grant error:', error.message);
      return NextResponse.json({ error: 'Failed to grant subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      company: company.name,
      plan: plan.name,
      status: 'active',
    });
  } catch (err) {
    console.error('[admin/accounts/[id]/subscription] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.member.is_super_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: companyId } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('company_id', companyId);

    if (error) {
      console.error('[admin/subscription] revoke error:', error.message);
      return NextResponse.json({ error: 'Failed to revoke subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/accounts/[id]/subscription] DELETE:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
