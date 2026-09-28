-- h2h_standings was flagged by the security advisor as a SECURITY
-- DEFINER view (runs with the view creator's privileges, bypassing the
-- querying user's own RLS on fixtures/leagues, unlike the pre-existing
-- `standings` view which doesn't have this issue). security_invoker=true
-- makes it evaluate under the querying user's own row-level policies
-- instead, same as any direct table query would.
drop view h2h_standings;

create view h2h_standings with (security_invoker = true) as
select
  f.league_id,
  side.team_id,
  count(*) filter (where f.status = 'completed') as series_played,
  count(*) filter (where f.status = 'completed' and side.team_id = f.winner_team_id) as series_won,
  count(*) filter (where f.status = 'completed' and side.team_id != f.winner_team_id) as series_lost,
  coalesce(sum(case when side.team_id = f.home_team_id then f.home_score else f.away_score end)
    filter (where f.status = 'completed'), 0) as maps_won,
  coalesce(sum(case when side.team_id = f.home_team_id then f.away_score else f.home_score end)
    filter (where f.status = 'completed'), 0) as maps_lost,
  count(*) filter (where f.status = 'completed' and side.team_id = f.winner_team_id) * 3 as total_points
from fixtures f
cross join lateral (values (f.home_team_id), (f.away_team_id)) as side(team_id)
group by f.league_id, side.team_id
order by f.league_id, total_points desc;
