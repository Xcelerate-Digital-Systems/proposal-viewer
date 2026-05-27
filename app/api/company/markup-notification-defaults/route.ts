// app/api/company/markup-notification-defaults/route.ts
//
// Owner/admin-only CRUD for the agency-level markup notification defaults.
// These columns are read when seeding new `review_project_assignees` and
// `review_project_guest_recipients` rows so a project starts with the
// admin's chosen defaults. Project-level rows still override.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import {
  ALL_ON_PREFS,
  MARKUP_NOTIFY_KEYS,
  getCompanyMarkupDefaults,
  type MarkupNotifyPrefs,
} from '@/lib/markup-notification-defaults';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const prefs = await getCompanyMarkupDefaults(supabase, auth.companyId);
  return NextResponse.json({ defaults: prefs });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { member } = auth;
  const allowed =
    member.is_super_admin || member.role === 'owner' || member.role === 'admin';
  if (!allowed) {
    return NextResponse.json(
      { error: 'Only owners and admins can change agency notification defaults' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const incoming = (body?.defaults ?? body) as Partial<MarkupNotifyPrefs>;

  const update: Record<string, boolean> = {};
  for (const key of MARKUP_NOTIFY_KEYS) {
    if (typeof incoming?.[key] === 'boolean') {
      update[`markup_${key}`] = incoming[key] as boolean;
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('companies')
    .update(update)
    .eq('id', auth.companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const next = await getCompanyMarkupDefaults(supabase, auth.companyId);
  return NextResponse.json({ defaults: next ?? ALL_ON_PREFS });
}
