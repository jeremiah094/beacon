-- Head-to-head fixtures get the same match-notify moments Apex games have
-- (20260914131000_match_notify_triggers.sql): "new match" when fixtures
-- are scheduled in a published league, and "starts in 10 minutes" at the
-- lineup-lock tick. match-notify narrows fixture recipients to the two
-- teams playing.
--
-- Also restores Apex's lock_soon push: 20261004111603_fixture_lineup_lock.sql
-- rewrote lock_overdue_lineups() back to its original set-based form to add
-- the fixtures lock and, in doing so, dropped the per-game net.http_post
-- that 20260914131000 had added — Apex players have had no "lobby opens in
-- 10 minutes" push since then. Both lock paths now loop over exactly the
-- rows this tick locked (UPDATE ... RETURNING), one notify per row, so a
-- game/fixture is notified once, at the moment it locks.
create or replace function lock_overdue_lineups()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
begin
  for r in
    update games
    set lineup_locked_at = now()
    where lineup_locked_at is null
      and now() >= scheduled_at - interval '10 minutes'
    returning id
  loop
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/match-notify',
      body := jsonb_build_object('type', 'lock_soon', 'gameId', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;

  -- Set-based, not just this tick's games: also catches a lineup row
  -- created after its game already locked.
  update lineups l
  set locked_at = now()
  from games g
  where l.game_id = g.id
    and l.locked_at is null
    and g.lineup_locked_at is not null;

  for r in
    update fixtures
    set lineup_locked_at = now(),
        status = 'lineup_lock'
    where lineup_locked_at is null
      and status = 'scheduled'
      and now() >= scheduled_at - interval '10 minutes'
    returning id
  loop
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/match-notify',
      body := jsonb_build_object('type', 'lock_soon', 'fixtureId', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end;
$$;

-- Statement-level, unlike games_notify_new_match: "Generate round robin"
-- inserts a whole season of fixtures in one statement, and a per-row
-- trigger would send each player one push per fixture (7 at once in an
-- 8-team league). One call per league per statement carries every new
-- fixture id; match-notify folds them into one message per player.
create or replace function notify_new_fixtures()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
begin
  for r in
    select n.league_id, jsonb_agg(n.id) as fixture_ids
    from new_fixtures n
    join leagues l on l.id = n.league_id
    where l.status = 'published'
      and n.status != 'cancelled'
    group by n.league_id
  loop
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/match-notify',
      body := jsonb_build_object('type', 'new_match', 'fixtureIds', r.fixture_ids),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
  return null;
end;
$$;

create trigger fixtures_notify_new_match
  after insert on fixtures
  referencing new table as new_fixtures
  for each statement execute function notify_new_fixtures();

-- Same lockdown as notify_new_match / lock_overdue_lineups
-- (20260914131100, 20260914125100): trigger/cron-only, never an RPC.
revoke execute on function notify_new_fixtures() from public, anon, authenticated;
revoke execute on function lock_overdue_lineups() from public, anon, authenticated;
grant execute on function lock_overdue_lineups() to service_role;
