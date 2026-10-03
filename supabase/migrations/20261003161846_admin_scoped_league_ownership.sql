-- Option 1 from the decentralized-leagues design-thinking pass: an admin
-- should only manage (and, in the admin console specifically) only see
-- leagues they created. leagues.created_by already exists and is already
-- populated on every league (lib/api/adminLeagues.ts) — this just makes
-- RLS actually read it, instead of every admin reaching every league via
-- a flat is_admin() check.
--
-- Uses ALTER POLICY rather than DROP + CREATE POLICY (the usual pattern
-- elsewhere in this schema) — DROP POLICY was found to reliably hang this
-- session's migration tooling on this project even for trivial policies
-- on unrelated tables, while ALTER POLICY (which redefines an existing
-- policy's USING/WITH CHECK in place, no drop involved) worked instantly.
-- Functionally identical end state either way.
--
-- Depends on the three private.owns_league*() helpers added in
-- 20261003081326_admin_scoped_league_ownership_helpers.sql.

-- leagues: published stays visible to everyone (players browsing leagues
-- to join) — only the admin branch gets scoped to the creator. insert is
-- unchanged (created_by is set by the app on insert); update/delete now
-- require ownership on both qual and with_check, so an admin can't edit
-- someone else's league, and can't reassign created_by to steal one.
alter policy leagues_select on leagues
  using (status = 'published' or (private.is_admin() and created_by = auth.uid()));
alter policy leagues_update on leagues
  using (private.is_admin() and created_by = auth.uid())
  with check (private.is_admin() and created_by = auth.uid());
alter policy leagues_delete on leagues
  using (private.is_admin() and created_by = auth.uid());

-- games (Apex)
alter policy games_select on games using (
  (private.is_admin() and private.owns_league(league_id))
  or exists (select 1 from leagues l where l.id = games.league_id and l.status = 'published')
);
alter policy games_insert on games with check (private.is_admin() and private.owns_league(league_id));
alter policy games_update on games
  using (private.is_admin() and private.owns_league(league_id))
  with check (private.is_admin() and private.owns_league(league_id));
alter policy games_delete on games using (private.is_admin() and private.owns_league(league_id));

-- fixtures (Valorant) — same shape as games
alter policy fixtures_select on fixtures using (
  (private.is_admin() and private.owns_league(league_id))
  or exists (select 1 from leagues l where l.id = fixtures.league_id and l.status = 'published')
);
alter policy fixtures_insert on fixtures with check (private.is_admin() and private.owns_league(league_id));
alter policy fixtures_update on fixtures
  using (private.is_admin() and private.owns_league(league_id))
  with check (private.is_admin() and private.owns_league(league_id));
alter policy fixtures_delete on fixtures using (private.is_admin() and private.owns_league(league_id));

-- league_teams: registrations belong to the league being registered for.
-- Captains inserting their own team's registration is unaffected.
alter policy league_teams_select on league_teams
  using (private.is_team_member(team_id) or (private.is_admin() and private.owns_league(league_id)));
alter policy league_teams_decide on league_teams
  using (private.is_admin() and private.owns_league(league_id))
  with check (private.is_admin() and private.owns_league(league_id));

-- results (placement/kills per game)
alter policy results_select on results using (
  (private.is_admin() and private.owns_league_for_game(game_id))
  or exists (
    select 1 from games g join leagues l on l.id = g.league_id
    where g.id = results.game_id and l.status = 'published'
  )
);
alter policy results_insert on results with check (private.is_admin() and private.owns_league_for_game(game_id));
alter policy results_update on results
  using (private.is_admin() and private.owns_league_for_game(game_id))
  with check (private.is_admin() and private.owns_league_for_game(game_id));
alter policy results_delete on results using (private.is_admin() and private.owns_league_for_game(game_id));

-- lobby_presence (Monitor screen's in-lobby checklist)
alter policy lobby_presence_admin_all on lobby_presence
  using (private.is_admin() and private.owns_league_for_game(game_id))
  with check (private.is_admin() and private.owns_league_for_game(game_id));

-- substitution_requests (captain-raised, admin-decided)
alter policy substitution_requests_select on substitution_requests
  using (private.is_team_member(team_id) or (private.is_admin() and private.owns_league_for_game(game_id)));
alter policy substitution_requests_decide on substitution_requests
  using (private.is_admin() and private.owns_league_for_game(game_id))
  with check (private.is_admin() and private.owns_league_for_game(game_id));

-- substitutions (the applied record, once an admin approves a request)
alter policy substitutions_select on substitutions
  using (private.is_team_member(team_id) or (private.is_admin() and private.owns_league_for_game(game_id)));
alter policy substitutions_insert on substitutions
  with check (private.is_admin() and private.owns_league_for_game(game_id));

-- fixture_maps (Valorant per-map scores)
alter policy fixture_maps_select on fixture_maps using (
  (private.is_admin() and private.owns_league_for_fixture(fixture_id))
  or exists (
    select 1 from fixtures f join leagues l on l.id = f.league_id
    where f.id = fixture_maps.fixture_id and l.status = 'published'
  )
);
alter policy fixture_maps_write on fixture_maps
  using (private.is_admin() and private.owns_league_for_fixture(fixture_id))
  with check (private.is_admin() and private.owns_league_for_fixture(fixture_id));

-- fixture_lineups
alter policy fixture_lineups_select on fixture_lineups
  using (private.is_team_member(team_id) or (private.is_admin() and private.owns_league_for_fixture(fixture_id)));

-- lineups (admin's read-only override branch only — captain write policies untouched)
alter policy lineups_select on lineups
  using (private.is_team_member(team_id) or (private.is_admin() and private.owns_league_for_game(game_id)));

-- lineup_players: one more hop (lineup_id -> lineups.game_id -> leagues).
-- Scoped so a non-owning admin can no longer read or edit another
-- league's lineup composition via this table directly.
alter policy lineup_players_select on lineup_players using (
  exists (
    select 1 from lineups l
    where l.id = lineup_players.lineup_id
      and (private.is_team_member(l.team_id) or (private.is_admin() and private.owns_league_for_game(l.game_id)))
  )
);
alter policy lineup_players_insert on lineup_players with check (
  private.can_edit_lineup(lineup_id)
  or exists (
    select 1 from lineups l
    where l.id = lineup_players.lineup_id
      and private.is_admin() and private.owns_league_for_game(l.game_id)
  )
);
alter policy lineup_players_delete on lineup_players using (
  private.can_edit_lineup(lineup_id)
  or exists (
    select 1 from lineups l
    where l.id = lineup_players.lineup_id
      and private.is_admin() and private.owns_league_for_game(l.game_id)
  )
);

-- admin_remove_team_from_league's matching ownership-check fix lives in
-- its own migration (20261003161900_admin_remove_team_from_league_ownership_check.sql)
-- rather than here, since — unlike everything above — it has not
-- actually applied to the live project yet (see that file for why).
