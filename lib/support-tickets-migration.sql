-- Support tickets system for the platform admin panel + customer support.
-- Run this migration against your Supabase project.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number integer generated always as identity unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by_user_id uuid not null,
  created_by_name text not null,
  created_by_email text not null,
  subject text not null check (char_length(subject) <= 200),
  description text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  category text not null default 'general'
    check (category in ('general', 'billing', 'bug', 'feature_request', 'account')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_support_tickets_company
  on public.support_tickets(company_id);
create index if not exists idx_support_tickets_status
  on public.support_tickets(status);
create index if not exists idx_support_tickets_created
  on public.support_tickets(created_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null,
  sender_name text not null,
  is_admin_reply boolean not null default false,
  body text not null check (char_length(body) <= 10000),
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_messages_ticket
  on public.support_ticket_messages(ticket_id);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

-- ── RLS policies for support_tickets ────────────────────────────────────────

-- Team members can view their own company's tickets.
create policy "Team members can view own company tickets"
  on public.support_tickets for select
  using (
    company_id in (
      select tm.company_id from public.team_members tm
      where tm.user_id = auth.uid()
    )
  );

-- Team members can create tickets for their own company.
create policy "Team members can create own company tickets"
  on public.support_tickets for insert
  with check (
    company_id in (
      select tm.company_id from public.team_members tm
      where tm.user_id = auth.uid()
    )
    and created_by_user_id = auth.uid()
  );

-- Super admins can view all tickets (for the platform admin panel).
create policy "Super admins can view all tickets"
  on public.support_tickets for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.is_super_admin = true
    )
  );

-- Super admins can update any ticket (status, priority changes).
create policy "Super admins can update any ticket"
  on public.support_tickets for update
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.is_super_admin = true
    )
  );

-- No direct deletes — tickets are closed, not deleted.

-- ── RLS policies for support_ticket_messages ────────────────────────────────

-- Team members can view messages on their own company's tickets.
create policy "Team members can view own company ticket messages"
  on public.support_ticket_messages for select
  using (
    ticket_id in (
      select st.id from public.support_tickets st
      where st.company_id in (
        select tm.company_id from public.team_members tm
        where tm.user_id = auth.uid()
      )
    )
  );

-- Team members can send messages on their own company's tickets.
create policy "Team members can insert messages on own company tickets"
  on public.support_ticket_messages for insert
  with check (
    sender_user_id = auth.uid()
    and is_admin_reply = false
    and ticket_id in (
      select st.id from public.support_tickets st
      where st.company_id in (
        select tm.company_id from public.team_members tm
        where tm.user_id = auth.uid()
      )
    )
  );

-- Super admins can view all messages.
create policy "Super admins can view all ticket messages"
  on public.support_ticket_messages for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.is_super_admin = true
    )
  );

-- Super admins can insert admin replies on any ticket.
create policy "Super admins can insert admin replies"
  on public.support_ticket_messages for insert
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.is_super_admin = true
    )
  );

-- No anon access to support tables.
revoke all on public.support_tickets from anon;
revoke all on public.support_ticket_messages from anon;
