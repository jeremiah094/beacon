-- Security advisor flagged the trigger function for a mutable search_path
-- (the same hardening every other function in this schema already has).
create or replace function enforce_games_per_opponent_lock()
returns trigger
language plpgsql
set search_path = public
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
