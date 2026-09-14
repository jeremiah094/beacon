create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- BUILD.md §5: every minute, lock any game that has reached T-10m and
-- isn't locked yet, and flip its lineups to locked. Implemented as a direct
-- SQL function (atomic, no network hop, no secret management) rather than
-- an HTTP round-trip to an Edge Function — supabase/functions/lineup-lock
-- still exists as a thin wrapper around this same function for manual
-- triggering and Edge Function log visibility, it's just not what cron
-- actually calls.
create or replace function lock_overdue_lineups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update games
  set lineup_locked_at = now()
  where lineup_locked_at is null
    and now() >= scheduled_at - interval '10 minutes';

  update lineups l
  set locked_at = now()
  from games g
  where l.game_id = g.id
    and l.locked_at is null
    and g.lineup_locked_at is not null;
end;
$$;

select cron.schedule('lineup-lock', '* * * * *', $$select lock_overdue_lineups()$$);
