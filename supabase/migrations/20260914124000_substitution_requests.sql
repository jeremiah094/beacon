-- Pending queue for emergency substitution requests (screen 06 captain
-- request -> screen 14 admin approval). Distinct from `substitutions`,
-- which BUILD.md defines as the append-only log of substitutions that
-- have actually happened.
create table substitution_requests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  out_profile_id uuid not null references profiles(id),
  in_profile_id uuid not null references profiles(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_by uuid not null references profiles(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references profiles(id),
  decided_at timestamptz
);

create index on substitution_requests (game_id, team_id);
create index on substitution_requests (out_profile_id);
create index on substitution_requests (in_profile_id);
create index on substitution_requests (requested_by);
create index on substitution_requests (decided_by);

alter table substitution_requests enable row level security;

create policy substitution_requests_select on substitution_requests for select
  using (private.is_team_member(team_id) or private.is_admin());

create policy substitution_requests_insert on substitution_requests for insert
  with check (private.is_team_captain(team_id) and requested_by = (select auth.uid()));

create policy substitution_requests_decide on substitution_requests for update
  using (private.is_admin())
  with check (private.is_admin());
