create or replace view standings as
select
  g.league_id,
  r.team_id,
  count(*) filter (where r.published_at is not null) as games_played,
  coalesce(sum(r.kills) filter (where r.published_at is not null), 0) as total_kills,
  coalesce(sum(placement_points(r.placement)) filter (where r.published_at is not null), 0) as total_placement_points,
  coalesce(sum(placement_points(r.placement)) filter (where r.published_at is not null), 0)
    + coalesce(sum(r.kills) filter (where r.published_at is not null), 0) as total_points
from results r
join games g on g.id = r.game_id
group by g.league_id, r.team_id
order by g.league_id, total_points desc;
