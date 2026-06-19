// app/api/campaigns/[id]/guests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { getCompanyMarkupDefaults } from '@/lib/markup-notification-defaults';
import { sendGuestInviteEmail } from '@/lib/feedback/send-guest-invite';
import { upsertContact } from '@/lib/contacts';
import { authRateLimit } from '@/lib/rate-limit';

type GuestPrefs = {
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
};

const DEFAULT_PREFS: GuestPrefs = {
  notify_comment: true,
  notify_reply: true,
  notify_resolve: true,
  notify_status: true,
  notify_new_version: true,
};

const PREF_KEYS: (keyof GuestPrefs)[] = [
  'notify_comment', 'notify_reply', 'notify_resolve', 'notify_status', 'notify_new_version',
];

// GET — list every email that's commented on the project (or is the
// project's `client_email`) along with whatever stored prefs we have.
// Excludes emails that belong to a team member of the same company,
// since those are managed via the assignees panel.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/guests');
    if (limited) return limited;


  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id, client_email, client_name')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ data: itemRows }, { data: storedRows }, { data: companyMembers }] = await Promise.all([
    supabase.from('review_items').select('id').eq('review_project_id', params.id),
    supabase.from('review_project_guest_recipients').select('*').eq('review_project_id', params.id),
    supabase.from('team_members').select('email').eq('company_id', auth.companyId),
  ]);

  const teamEmails = new Set(
    (companyMembers ?? [])
      .map((m) => m.email?.trim().toLowerCase())
      .filter((e): e is string => !!e)
  );

  const itemIds = (itemRows ?? []).map((r) => r.id as string);

  // Build a map: email -> { name, latestAt }. Latest name wins so the panel
  // shows whatever they last signed comments as.
  const emailToName = new Map<string, { name: string; createdAt: string }>();
  if (itemIds.length > 0) {
    const { data: comments } = await supabase
      .from('review_comments')
      .select('author_email, author_name, created_at')
      .in('review_item_id', itemIds)
      .not('author_email', 'is', null)
      .order('created_at', { ascending: false });
    for (const c of comments ?? []) {
      const email = (c as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (!email || teamEmails.has(email)) continue;
      if (!emailToName.has(email)) {
        emailToName.set(email, {
          name: (c as { author_name: string | null }).author_name?.trim() || '',
          createdAt: (c as { created_at: string }).created_at,
        });
      }
    }
  }

  // Always include the project's client_email even if they haven't commented yet.
  if (project.client_email) {
    const email = project.client_email.trim().toLowerCase();
    if (!teamEmails.has(email) && !emailToName.has(email)) {
      emailToName.set(email, {
        name: project.client_name?.trim() || '',
        createdAt: new Date(0).toISOString(),
      });
    }
  }

  type StoredRow = {
    email: string;
    name: string | null;
    notify_comment: boolean;
    notify_reply: boolean;
    notify_resolve: boolean;
    notify_status: boolean;
    notify_new_version: boolean;
    removed_at: string | null;
    created_at: string;
    stages: string[] | null;
  };
  const storedRowList = (storedRows ?? []) as StoredRow[];
  const storedByEmail = new Map<string, StoredRow>();
  for (const row of storedRowList) {
    storedByEmail.set(row.email.trim().toLowerCase(), row);
  }

  // Also include any stored row whose email no longer matches a comment,
  // so admins can still see and toggle them (e.g. a manually-added entry).
  for (const row of storedRowList) {
    const email = row.email.trim().toLowerCase();
    if (!emailToName.has(email)) {
      emailToName.set(email, { name: row.name?.trim() || '', createdAt: row.created_at });
    }
  }

  const guests = Array.from(emailToName.entries()).map(([email, info]) => {
    const stored = storedByEmail.get(email);
    return {
      email,
      name: info.name,
      removed: !!stored?.removed_at,
      stages: stored?.stages ?? [],
      prefs: stored
        ? {
            notify_comment: stored.notify_comment,
            notify_reply: stored.notify_reply,
            notify_resolve: stored.notify_resolve,
            notify_status: stored.notify_status,
            notify_new_version: stored.notify_new_version,
          }
        : DEFAULT_PREFS,
    };
  });

  // Sort: not-removed first, then alphabetically by name/email.
  guests.sort((a, b) => {
    if (a.removed !== b.removed) return a.removed ? 1 : -1;
    const an = (a.name || a.email).toLowerCase();
    const bn = (b.name || b.email).toLowerCase();
    return an.localeCompare(bn);
  });

  return NextResponse.json({ guests });
}

// POST — manually add a guest by email + name.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/guests');
    if (limited) return limited;


  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const sendInvite = body.sendInvite !== false;
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const defaults = await getCompanyMarkupDefaults(supabase, auth.companyId);

  const { error } = await supabase
    .from('review_project_guest_recipients')
    .upsert(
      {
        review_project_id: params.id,
        email,
        name: name || null,
        ...defaults,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'review_project_id,email' }
    );

  if (error) {
    console.error('[api/campaigns/[id]/guests]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  upsertContact(supabase, auth.companyId, { email, name, source: 'campaign_guest' });

  let invited = false;
  if (sendInvite && auth.member?.user_id) {
    try {
      await sendGuestInviteEmail({
        supabase,
        projectId: params.id,
        guestEmail: email,
        guestName: name,
        inviterUserId: auth.member.user_id,
      });
      invited = true;
    } catch (err) {
      console.error('[api/campaigns/[id]/guests] invite email failed:', err);
    }
  }

  return NextResponse.json({ success: true, invited });
}

// PATCH — upsert prefs (or removed flag) for a single guest email.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/guests');
    if (limited) return limited;


  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const update: Record<string, unknown> = {
    review_project_id: params.id,
    email,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === 'string') update.name = body.name;
  if (body.prefs && typeof body.prefs === 'object') {
    for (const key of PREF_KEYS) {
      if (typeof body.prefs[key] === 'boolean') update[key] = body.prefs[key];
    }
  }
  if (typeof body.removed === 'boolean') {
    update.removed_at = body.removed ? new Date().toISOString() : null;
  }

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // First-touch upsert needs to seed any prefs the admin didn't explicitly
  // toggle from the agency defaults; otherwise we'd silently fall back to
  // the column DEFAULTs and ignore the workspace-level setting.
  const { data: existingGuest } = await supabase
    .from('review_project_guest_recipients')
    .select('email')
    .eq('review_project_id', params.id)
    .eq('email', email)
    .maybeSingle();

  if (!existingGuest) {
    const defaults = await getCompanyMarkupDefaults(supabase, auth.companyId);
    for (const key of PREF_KEYS) {
      if (!(key in update)) update[key] = defaults[key];
    }
  }

  const { error } = await supabase
    .from('review_project_guest_recipients')
    .upsert(update, { onConflict: 'review_project_id,email' });

  if (error) {
    console.error('[api/campaigns/[id]/guests]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
