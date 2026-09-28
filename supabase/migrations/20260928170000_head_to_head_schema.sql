-- Head-to-head schema: the shape Valorant, CS2, and Rocket League all
-- share — two teams play a best-of-N series, as opposed to Apex's
-- N-teams-in-one-lobby battle royale (games/results/lineups). Built once
-- for Valorant; CS2/Rocket League reuse this unchanged.
create table fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  round_number int not null,
  scheduled_at timestamptz not null,
  best_of int not null default 3 check (best_of in (1, 3, 5)),
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'lineup_lock', 'live', 'completed', 'cancelled')),
  lineup_locked_at timestamptz,
  winner_team_id uuid references teams(id),
  home_score int,  -- maps/games won in the series
  away_score int,
  check (home_team_id <> away_team_id)
);

create unique index fixtures_league_round_teams_unique
  on fixtures (league_id, round_number, home_team_id, away_team_id)
  where status != 'cancelled';

create index on fixtures (league_id, scheduled_at);

-- One row per map/game within the series (Valorant/CS2: rounds per map;
-- Rocket League: goals per game).
create table fixture_maps (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures(id) on delete cascade,
  map_number int not null,
  map_name text,
  home_score int,
  away_score int,
  winner_team_id uuid references teams(id),
  unique (fixture_id, map_number)
);

-- Who started for each side — the head-to-head equivalent of
-- lineups/lineup_players, but a fixture has two sides sharing one row
-- shape instead of one team per games row.
create table fixture_lineups (
  fixture_id uuid not null references fixtures(id) on delete cascade,
  team_id uuid not null references teams(id),
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (fixture_id, team_id, profile_id)
);

create index on fixture_lineups (profile_id);

-- Mirrors `standings`'s role, but for series wins/losses instead of
-- placement+kills. 3 points per series win — no draws are possible in
-- any of the head-to-head titles (Bo1/Bo3/Bo5 always has a winner).
create view h2h_standings as
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

-- RLS mirrors games/results/lineups: any signed-in user can read (team
-- names/scores aren't sensitive, matches the existing standings/games
-- visibility), only admins write. fixture_lineups additionally lets a
-- captain manage their own team's starters, same as lineups.
alter table fixtures enable row level security;
create policy fixtures_select on fixtures for select to authenticated using (true);
create policy fixtures_insert on fixtures for insert with check (private.is_admin());
create policy fixtures_update on fixtures for update using (private.is_admin()) with check (private.is_admin());
create policy fixtures_delete on fixtures for delete using (private.is_admin());

alter table fixture_maps enable row level security;
create policy fixture_maps_select on fixture_maps for select to authenticated using (true);
create policy fixture_maps_write on fixture_maps for all using (private.is_admin()) with check (private.is_admin());

alter table fixture_lineups enable row level security;
create policy fixture_lineups_select on fixture_lineups for select to authenticated using (true);
create policy fixture_lineups_captain_write on fixture_lineups for all
  using (private.is_team_captain(team_id))
  with check (private.is_team_captain(team_id));
