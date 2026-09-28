-- Corrects the head-to-head RLS policies to actually match their
-- battle_royale precedents (games_select/results_select/lineups_select),
-- not just approximate them:
-- - fixtures/fixture_maps: visible once the league is published, not to
--   every authenticated user regardless of league status (games_select's
--   exact gate).
-- - fixture_lineups: team-member-or-admin only, same as lineups_select —
--   roster composition isn't public the way scores are.
drop policy fixtures_select on fixtures;
create policy fixtures_select on fixtures for select
  using (
    private.is_admin()
    or exists (select 1 from leagues l where l.id = fixtures.league_id and l.status = 'published')
  );

drop policy fixture_maps_select on fixture_maps;
create policy fixture_maps_select on fixture_maps for select
  using (
    private.is_admin()
    or exists (
      select 1 from fixtures f join leagues l on l.id = f.league_id
      where f.id = fixture_maps.fixture_id and l.status = 'published'
    )
  );

drop policy fixture_lineups_select on fixture_lineups;
create policy fixture_lineups_select on fixture_lineups for select
  using (private.is_team_member(team_id) or private.is_admin());
