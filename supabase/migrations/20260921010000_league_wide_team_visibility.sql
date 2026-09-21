-- teams_select / league_teams_select only let a player read rows for teams
-- they themselves belong to, not every team registered in a league they're
-- also registered in — that breaks any screen needing to show a full
-- league's teams to a normal player (the Games results table, and
-- lib/api/standings.ts's `teams(name)` embed, which has the same gap).
-- Additive: Postgres OR's multiple permissive SELECT policies together, so
-- this only ever widens visibility, never narrows existing access.
--
-- Lives in `private`, not `public`, matching every other RLS helper
-- (20260914113627_move_rls_helpers_to_private_schema.sql) — public schema
-- functions get exposed as PostgREST RPCs, internal ones don't need to be.
create or replace function private.is_league_teammate(p_team_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from league_teams lt_target
    join league_teams lt_mine on lt_mine.league_id = lt_target.league_id
    join team_members tm on tm.team_id = lt_mine.team_id
    where lt_target.team_id = p_team_id
      and lt_target.status = 'approved'
      and lt_mine.status = 'approved'
      and tm.profile_id = auth.uid()
  );
$$;

grant execute on function private.is_league_teammate(uuid) to anon, authenticated;

create policy teams_select_league_teammates on public.teams
  for select using (private.is_league_teammate(id));

create policy league_teams_select_league_teammates on public.league_teams
  for select using (private.is_league_teammate(team_id));
