// app/api/feedback/variant-decisions/route.ts
//
// Per-variant approve/changes-requested decisions on Meta ad copy variants.
// Supports both admin (Bearer auth) and guest (share_token) callers.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

/* ================================================================== */
/*  Auth helpers                                                       */
/* ================================================================== */

/** Resolve the caller's identity. Returns either a member context or a guest
 *  identity, plus the verified company_id for the item. */
async function resolveCallerAndItem(req: NextRequest, itemId: string) {
  const supabase = createServiceClient();
  const hasAuthHeader = !!req.headers.get('authorization');

  // Load the item first — we need company_id and project_id for both paths.
  const { data: item, error: itemErr } = await supabase
    .from('review_items')
    .select('id, company_id, review_project_id, status')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) {
    return { error: NextResponse.json({ error: 'Item not found' }, { status: 404 }) };
  }

  if (hasAuthHeader) {
    // Admin path — Bearer token auth.
    const auth = await getAuthContext(req);
    if (!auth) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const limited = await authRateLimit(auth.companyId, 'feedback/variant-decisions');
    if (limited) return { error: limited };

    if (!auth.member.is_super_admin && item.company_id !== auth.companyId) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return {
      supabase,
      item,
      reviewer: {
        kind: 'member' as const,
        team_member_id: auth.member.id,
        email: auth.member.email,
        name: auth.member.name,
      },
    };
  }

  // Guest path — share_token from query or body.
  const shareToken =
    req.nextUrl.searchParams.get('share_token') ||
    null;

  if (!shareToken) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Verify share_token matches the item's project.
  const { data: project } = await supabase
    .from('review_projects')
    .select('id')
    .eq('id', item.review_project_id)
    .eq('share_token', shareToken)
    .maybeSingle();

  if (!project) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return {
    supabase,
    item,
    reviewer: { kind: 'guest' as const, team_member_id: null, email: null as string | null, name: null as string | null },
  };
}

/* ================================================================== */
/*  GET — Fetch decisions for an item's variants                       */
/* ================================================================== */

export async function GET(req: NextRequest) {
  try {
    const itemId = req.nextUrl.searchParams.get('item_id');
    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const hasAuthHeader = !!req.headers.get('authorization');
    const shareToken = req.nextUrl.searchParams.get('share_token');

    // Lightweight auth: verify the caller can see this item.
    const { data: item } = await supabase
      .from('review_items')
      .select('id, company_id, review_project_id')
      .eq('id', itemId)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (hasAuthHeader) {
      const auth = await getAuthContext(req);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (!auth.member.is_super_admin && item.company_id !== auth.companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (shareToken) {
      const { data: project } = await supabase
        .from('review_projects')
        .select('id')
        .eq('id', item.review_project_id)
        .eq('share_token', shareToken)
        .maybeSingle();
      if (!project) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: decisions, error } = await supabase
      .from('review_variant_decisions')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch variant decisions error:', error);
      return NextResponse.json({ error: 'Failed to fetch decisions' }, { status: 500 });
    }

    return NextResponse.json({ decisions: decisions ?? [] });
  } catch (err) {
    console.error('Variant decisions GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ================================================================== */
/*  POST — Create or update a variant decision (upsert)                */
/* ================================================================== */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { item_id, variant_id, decision, stage, share_token, guest_email, guest_name } = body;
    if (!item_id || !variant_id || !decision || !stage) {
      return NextResponse.json(
        { error: 'item_id, variant_id, decision, and stage are required' },
        { status: 400 },
      );
    }

    if (!['approved', 'changes_requested'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision value' }, { status: 400 });
    }

    // Inject share_token into searchParams so resolveCallerAndItem can read it.
    if (share_token) {
      req.nextUrl.searchParams.set('share_token', share_token);
    }

    const ctx = await resolveCallerAndItem(req, item_id);
    if ('error' in ctx) return ctx.error;

    const { supabase, item } = ctx;
    let reviewer = ctx.reviewer;

    // If guest, fill in identity from request body.
    if (reviewer.kind === 'guest') {
      if (!guest_email) {
        return NextResponse.json({ error: 'guest_email is required for guest reviewers' }, { status: 400 });
      }
      reviewer = { ...reviewer, email: guest_email, name: guest_name || null };
    }

    // Upsert: delete any existing decision for this (item, variant, stage, reviewer),
    // then insert the new one. This is simpler than ON CONFLICT with partial indexes.
    if (reviewer.kind === 'member') {
      await supabase
        .from('review_variant_decisions')
        .delete()
        .eq('item_id', item_id)
        .eq('variant_id', variant_id)
        .eq('stage', stage)
        .eq('reviewer_team_member_id', reviewer.team_member_id!);
    } else {
      await supabase
        .from('review_variant_decisions')
        .delete()
        .eq('item_id', item_id)
        .eq('variant_id', variant_id)
        .eq('stage', stage)
        .eq('reviewer_email', reviewer.email!);
    }

    const row: Record<string, unknown> = {
      item_id,
      variant_id,
      company_id: item.company_id,
      stage,
      reviewer_kind: reviewer.kind,
      decision,
    };

    if (reviewer.kind === 'member') {
      row.reviewer_team_member_id = reviewer.team_member_id;
    }
    if (reviewer.email) row.reviewer_email = reviewer.email;
    if (reviewer.name) row.reviewer_name = reviewer.name;

    const { data: inserted, error: insertErr } = await supabase
      .from('review_variant_decisions')
      .insert(row)
      .select()
      .single();

    if (insertErr) {
      console.error('Insert variant decision error:', insertErr);
      return NextResponse.json({ error: 'Failed to save decision' }, { status: 500 });
    }

    return NextResponse.json({ success: true, decision: inserted });
  } catch (err) {
    console.error('Variant decisions POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ================================================================== */
/*  DELETE — Clear a variant decision                                  */
/* ================================================================== */

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { item_id, variant_id, share_token, guest_email } = body;
    if (!item_id || !variant_id) {
      return NextResponse.json({ error: 'item_id and variant_id are required' }, { status: 400 });
    }

    if (share_token) {
      req.nextUrl.searchParams.set('share_token', share_token);
    }

    const ctx = await resolveCallerAndItem(req, item_id);
    if ('error' in ctx) return ctx.error;

    const { supabase } = ctx;
    let reviewer = ctx.reviewer;

    if (reviewer.kind === 'guest') {
      if (!guest_email) {
        return NextResponse.json({ error: 'guest_email is required for guest reviewers' }, { status: 400 });
      }
      reviewer = { ...reviewer, email: guest_email };
    }

    let query = supabase
      .from('review_variant_decisions')
      .delete()
      .eq('item_id', item_id)
      .eq('variant_id', variant_id);

    if (reviewer.kind === 'member') {
      query = query.eq('reviewer_team_member_id', reviewer.team_member_id!);
    } else {
      query = query.eq('reviewer_email', reviewer.email!);
    }

    const { error: delErr } = await query;
    if (delErr) {
      console.error('Delete variant decision error:', delErr);
      return NextResponse.json({ error: 'Failed to delete decision' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Variant decisions DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
