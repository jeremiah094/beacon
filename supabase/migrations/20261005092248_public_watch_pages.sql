-- Public /watch pages: league list, standings, schedule/live results for a
-- signed-out visitor. leagues/games/fixtures/results/fixture_maps already
-- had an RLS branch that works for anon (published-league, no auth
-- required) — the real gap is teams/league_teams, which have never had a
-- public branch at all: every existing policy requires team membership or
-- admin. Adds one, scoped to "this team is approved in a published
-- league," matching teams_select_search's existing precedent that a team
-- name by itself isn't considered sensitive.
create policy teams_select_public on teams for select
  using (
    exists (
      select 1 from league_teams lt
      join leagues l on l.id = lt.league_id
      where lt.team_id = teams.id and lt.status = 'approved' and l.status = 'published'
    )
  );

create policy league_teams_select_public on league_teams for select
  using (
    status = 'approved'
    and exists (select 1 from leagues l where l.id = league_teams.league_id and l.status = 'published')
  );

-- Same revoke-whole-table-then-grant-safe-columns pattern as the
-- games/fixtures lobby_code fix — teams.captain_id and
-- league_teams.decided_by both reference profiles, which anon has no
-- business resolving even indirectly, and a spectator has no reason to
-- see a rejection_reason or who decided a registration either.
revoke select on teams from anon;
grant select (id, name, tag, title_id) on teams to anon;

revoke select on league_teams from anon;
grant select (league_id, team_id, status, registered_at) on league_teams to anon;

-- leagues/results already had anon SELECT via Supabase's default
-- whole-table grant (RLS's published-league branch already allowed the
-- read) — narrowing the same way, for the same reason: created_by/
-- entered_by are profile references with no legitimate public use.
revoke select on leagues from anon;
grant select (
  id, name, region, teams_per_lobby, season_start, season_end, status,
  created_at, season_label, entry_rules, title_id, games_per_opponent
) on leagues to anon;

revoke select on results from anon;
grant select (id, game_id, team_id, placement, kills, published_at) on results to anon;

-- The observer's Twitch handle is the one piece of profile data a
-- spectator needs (to build the twitch.tv link for a live stream) — rather
-- than open any part of profiles' RLS to anon, this takes the already-
-- public observer_id off a game/fixture row and returns just the two
-- columns needed, scoped to that profile actually being an observer on a
-- published league's match. profiles itself never gets a public branch.
create or replace function public_observer_handle(p_profile_id uuid)
returns table(display_name text, twitch_login text)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, p.twitch_login
  from profiles p
  where p.id = p_profile_id
    and (
      exists (select 1 from games g join leagues l on l.id = g.league_id where g.observer_id = p.id and l.status = 'published')
      or exists (select 1 from fixtures f join leagues l on l.id = f.league_id where f.observer_id = p.id and l.status = 'published')
    );
$$;

grant execute on function public_observer_handle(uuid) to anon, authenticated;
