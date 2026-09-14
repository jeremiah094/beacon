-- BUILD.md §5 match-notify, trigger 1: fires on games insert where the
-- league is published.
create or replace function notify_new_match()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  is_published boolean;
begin
  select (status = 'published') into is_published from leagues where id = new.league_id;
  if is_published then
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/match-notify',
      body := jsonb_build_object('type', 'new_match', 'gameId', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end if;
  return new;
end;
$$;

create trigger games_notify_new_match
  after insert on games
  for each row execute function notify_new_match();

-- match-notify, trigger 2: "match starting soon" fires exactly at T-10m,
-- which is also the lineup-lock moment (BUILD.md §5) — so it's the same
-- cron tick that just locked each game, per newly-locked game rather than
-- the previous set-based UPDATE (need one HTTP call per game).
create or replace function lock_overdue_lineups()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  g record;
begin
  for g in
    select id from games
    where lineup_locked_at is null
      and now() >= scheduled_at - interval '10 minutes'
  loop
    update games set lineup_locked_at = now() where id = g.id;
    update lineups set locked_at = now() where game_id = g.id and locked_at is null;
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/match-notify',
      body := jsonb_build_object('type', 'lock_soon', 'gameId', g.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end;
$$;
