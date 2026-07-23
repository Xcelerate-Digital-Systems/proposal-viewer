import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';
import { upsertContact } from '@/lib/contacts';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns');
    if (limited) return limited;


    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const companyId = auth.companyId;

    const limitCheck = await checkResourceLimit(companyId, 'reviews');
    if (!limitCheck.allowed) {
      return NextResponse.json(buildLimitErrorBody(limitCheck, 'reviews'), { status: 402 });
    }

    const supabase = createServiceClient();

    const { data: created, error } = await supabase
      .from('review_projects')
      .insert({
        company_id: companyId,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        client_company: typeof body.client_company === 'string' ? body.client_company.trim() || null : null,
        client_name: typeof body.client_name === 'string' ? body.client_name.trim() || null : null,
        client_email: typeof body.client_email === 'string' ? body.client_email.trim() || null : null,
        created_by: auth.member.user_id ?? null,
      })
      .select('id')
      .single();

    if (error || !created) {
      console.error('[api/campaigns] POST:', error?.message);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    const clientEmail = typeof body.client_email === 'string' ? body.client_email.trim() : '';
    if (clientEmail) {
      upsertContact(supabase, companyId, {
        email: clientEmail,
        name: typeof body.client_name === 'string' ? body.client_name.trim() : undefined,
        organisation: typeof body.client_company === 'string' ? body.client_company.trim() : undefined,
        source: 'campaign_guest',
      });
    }

    // Apply workflow template if provided
    const templateId = typeof body.template_id === 'string' ? body.template_id : null;
    if (templateId) {
      const { data: tpl } = await supabase
        .from('review_workflow_templates')
        .select('stages, default_stage_due_offsets')
        .eq('id', templateId)
        .eq('company_id', companyId)
        .single();

      if (tpl) {
        const stages = Array.isArray(tpl.stages) ? tpl.stages : [];

        // Collect unique team member IDs and guest emails from template stages
        const memberIds = new Set<string>();
        const guestEmails = new Set<string>();
        const memberStageMap = new Map<string, string[]>();
        const guestStageMap = new Map<string, string[]>();

        for (const s of stages) {
          const stage = s as { stage: string; assignee_ids?: string[]; guest_emails?: string[] };
          for (const id of stage.assignee_ids ?? []) {
            memberIds.add(id);
            if (!memberStageMap.has(id)) memberStageMap.set(id, []);
            memberStageMap.get(id)!.push(stage.stage);
          }
          for (const email of stage.guest_emails ?? []) {
            const normalized = email.trim().toLowerCase();
            guestEmails.add(normalized);
            if (!guestStageMap.has(normalized)) guestStageMap.set(normalized, []);
            guestStageMap.get(normalized)!.push(stage.stage);
          }
        }

        // Insert team member assignees with their stages
        if (memberIds.size > 0) {
          const rows = Array.from(memberIds).map((id) => ({
            review_project_id: created.id,
            team_member_id: id,
            stages: memberStageMap.get(id) ?? [],
          }));
          await supabase
            .from('review_project_assignees')
            .upsert(rows, { onConflict: 'review_project_id,team_member_id' });
        }

        // Insert guest recipients with their stages
        if (guestEmails.size > 0) {
          const guestRows = Array.from(guestEmails).map((email) => ({
            review_project_id: created.id,
            email,
            name: '',
            stages: guestStageMap.get(email) ?? [],
          }));
          await supabase
            .from('review_project_guest_recipients')
            .upsert(guestRows, { onConflict: 'review_project_id,email' });
        }

        // Calculate and set stage due dates from offsets
        const offsets = tpl.default_stage_due_offsets as Record<string, number> | null;
        if (offsets && Object.keys(offsets).length > 0) {
          const stageDueDates: Record<string, string> = {};
          const now = new Date();
          for (const [stage, days] of Object.entries(offsets)) {
            if (typeof days === 'number' && days > 0) {
              const d = new Date(now);
              d.setDate(d.getDate() + days);
              stageDueDates[stage] = d.toISOString().split('T')[0];
            }
          }
          if (Object.keys(stageDueDates).length > 0) {
            await supabase
              .from('review_projects')
              .update({ stage_due_dates: stageDueDates })
              .eq('id', created.id);
          }
        }
      }
    }

    // Auto-assign the creating user (if not already added by template)
    if (auth.member.user_id) {
      const { data: tm } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', auth.member.user_id)
        .eq('company_id', companyId)
        .maybeSingle();
      if (tm?.id) {
        await supabase
          .from('review_project_assignees')
          .upsert(
            { review_project_id: created.id, team_member_id: tm.id },
            { onConflict: 'review_project_id,team_member_id' },
          );
      }
    }

    return NextResponse.json({ success: true, id: created.id });
  } catch (err) {
    console.error('[api/campaigns] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
