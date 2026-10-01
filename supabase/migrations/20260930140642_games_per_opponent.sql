-- How many times each pair of teams plays each other in a head-to-head
-- league's round robin (1 or 2 — Valorant pilot, reused by CS2/Rocket
-- League later since they share the same fixtures schema). Null for
-- battle_royale leagues, where a round-robin-of-opponents concept doesn't
-- apply — Apex's "every team plays every scheduled game" shape is
-- unrelated.
alter table leagues add column games_per_opponent int
  check (games_per_opponent is null or games_per_opponent in (1, 2));

-- Once a pair of teams has completed both legs under the current setting,
-- changing games_per_opponent (either direction) would contradict fixtures
-- that already happened, so it's locked from that point on. Pairs are
-- compared unordered (least/greatest) so a 2-leg round robin's two legs —
-- which swap home/away — are still recognised as the same pairing.
create or replace function enforce_games_per_opponent_lock()
returns trigger
language plpgsql
as $$
declare
  t1_id uuid;
  t2_id uuid;
  t1_name text;
  t2_name text;
begin
  if new.games_per_opponent is distinct from old.games_per_opponent then
    select least(f.home_team_id, f.away_team_id), greatest(f.home_team_id, f.away_team_id)
    into t1_id, t2_id
    from fixtures f
    where f.league_id = old.id and f.status = 'completed'
    group by least(f.home_team_id, f.away_team_id), greatest(f.home_team_id, f.away_team_id)
    having count(*) >= 2
    limit 1;

    if t1_id is not null then
      select name into t1_name from teams where id = t1_id;
      select name into t2_name from teams where id = t2_id;
      raise exception '% played against % twice already — the number of games per team can''t be changed once a pairing has completed both matches.', t1_name, t2_name;
    end if;
  end if;
  return new;
end;
$$;

create trigger leagues_lock_games_per_opponent
  before update on leagues
  for each row
  execute function enforce_games_per_opponent_lock();
