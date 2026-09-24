-- 1. Team names must be unique (case-insensitive) — the duplicate "Cork
-- onions" teams that prompted this migration were already resolved by
-- hand (the newer, empty one deleted) before this runs.
create unique index teams_name_unique on teams (lower(name));

-- 2. League names must be unique per season, not forever — the same
-- league name (e.g. "Division One") is expected to recur across seasons.
-- NULLS NOT DISTINCT (PG15+) treats two NULL season_labels as the same
-- "season" for uniqueness purposes, rather than never colliding.
create unique index leagues_name_season_unique on leagues (lower(name), season_label) nulls not distinct;

-- 3. Search-and-join needs any authenticated player to be able to find a
-- team by name, not just ones they already belong to or share a league
-- with. Additive: Postgres OR's multiple permissive SELECT policies
-- together, so this only ever widens visibility (name/tag/captain_id are
-- not sensitive), never narrows the existing, more specific policies.
create policy teams_select_search on public.teams
  for select to authenticated using (true);

-- 4. Join requests — a player asks to join an existing team, its captain
-- approves or rejects (mirrors the league-registration approval pattern
-- already used for league_teams). Approval itself still goes through
-- team_members' existing captain-only insert policy — this table just
-- records the request/decision, it doesn't bypass that.
create table team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id)
);

-- A player can have at most one *pending* request per team at a time —
-- doesn't block requesting again after a rejection, or requesting a
-- different team while one's already pending elsewhere.
create unique index team_join_requests_one_pending on team_join_requests (team_id, profile_id) where status = 'pending';

create index on team_join_requests (team_id) where status = 'pending';

alter table team_join_requests enable row level security;

create policy team_join_requests_select on team_join_requests for select
  using (profile_id = auth.uid() or private.is_team_captain(team_id) or private.is_admin());

create policy team_join_requests_insert on team_join_requests for insert
  with check (profile_id = auth.uid());

-- A requester can cancel their own still-pending request.
create policy team_join_requests_delete on team_join_requests for delete
  using (profile_id = auth.uid() and status = 'pending');

create policy team_join_requests_update on team_join_requests for update
  using (private.is_team_captain(team_id))
  with check (private.is_team_captain(team_id));
