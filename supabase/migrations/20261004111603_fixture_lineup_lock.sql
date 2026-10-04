-- Valorant player build: "lock a starting 5" needs the same server-side
-- guarantee Apex's lineups already have (BUILD.md §5 / lineup_lock_cron) —
-- right now fixture_lineups_captain_write has no time gate at all, so a
-- captain could technically swap a starter after the series has started.
--
-- fixtures has no per-team lineup row the way Apex's lineups table does —
-- lock state lives on the fixture itself (lineup_locked_at, status), so
-- one update per overdue fixture is enough; there's no second table to
-- cascade a locked_at timestamp into.
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

  update fixtures
  set lineup_locked_at = now(),
      status = 'lineup_lock'
  where lineup_locked_at is null
    and status = 'scheduled'
    and now() >= scheduled_at - interval '10 minutes';
end;
$$;

-- Same pattern as lineups_captain_write: a captain can only write while
-- the fixture's lineup isn't locked yet. Uses ALTER POLICY rather than
-- DROP + CREATE — this session's migration tooling reliably hangs on
-- DROP POLICY specifically, while ALTER POLICY (redefines the existing
-- policy's rule in place) runs instantly; see
-- 20261003161846_admin_scoped_league_ownership.sql for the full writeup.
alter policy fixture_lineups_captain_write on fixture_lineups
  using (
    private.is_team_captain(team_id)
    and exists (select 1 from fixtures f where f.id = fixture_lineups.fixture_id and f.lineup_locked_at is null)
  )
  with check (
    private.is_team_captain(team_id)
    and exists (select 1 from fixtures f where f.id = fixture_lineups.fixture_id and f.lineup_locked_at is null)
  );
