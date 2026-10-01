-- Observer live-streaming (Twitch now, YouTube skeleton for later).
-- profiles.twitch_login is public (a Twitch username, not a secret) and is
-- the only thing an observer sets — no OAuth, no token ever stored here.
-- youtube_channel_id is an unused placeholder for the "coming soon" UI.
alter table profiles
  add column twitch_login text,
  add column youtube_channel_id text;

-- Cached live-status, written only by the twitch-stream-status edge
-- function (via service role, triggered by the cron below) — never
-- written by a client directly.
alter table games
  add column observer_stream_live boolean not null default false,
  add column observer_stream_title text,
  add column observer_stream_viewers int,
  add column observer_stream_checked_at timestamptz;

alter table fixtures
  add column observer_stream_live boolean not null default false,
  add column observer_stream_title text,
  add column observer_stream_viewers int,
  add column observer_stream_checked_at timestamptz;

-- Every minute, batch up every live-ish game/fixture whose assigned
-- observer has a Twitch login set, and ask the edge function to check
-- Twitch's Get Streams for all of them in one call. Mirrors
-- lock_overdue_lineups()'s net.http_post pattern
-- (20260914131000_match_notify_triggers.sql) rather than inventing a new
-- one.
create or replace function poll_observer_streams()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  payload jsonb;
begin
  select jsonb_agg(jsonb_build_object('table', 'games', 'id', g.id, 'twitchLogin', p.twitch_login))
    into payload
  from games g
  join profiles p on p.id = g.observer_id
  where g.status in ('lobby_open', 'in_progress')
    and p.twitch_login is not null;

  if payload is not null then
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/twitch-stream-status',
      body := jsonb_build_object('entries', payload),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end if;

  select jsonb_agg(jsonb_build_object('table', 'fixtures', 'id', f.id, 'twitchLogin', p.twitch_login))
    into payload
  from fixtures f
  join profiles p on p.id = f.observer_id
  where f.status in ('lineup_lock', 'live')
    and p.twitch_login is not null;

  if payload is not null then
    perform net.http_post(
      url := 'https://mcjxelzimstpebomjvqk.supabase.co/functions/v1/twitch-stream-status',
      body := jsonb_build_object('entries', payload),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end if;
end;
$$;

select cron.schedule('twitch-stream-poll', '* * * * *', $$select poll_observer_streams()$$);
