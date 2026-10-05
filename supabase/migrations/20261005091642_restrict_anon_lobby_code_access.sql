-- Security fix, found while planning public league/standings pages: the
-- anon role has had unrestricted whole-table SELECT on games and fixtures
-- since project creation (Supabase's default bootstrap grants both anon
-- and authenticated broad table privileges; RLS is meant to be the real
-- gate). games_select/fixtures_select's "published league" RLS branch has
-- no auth requirement at all, so any published league's lobby_code was
-- already readable by anyone with the public API key via a direct REST
-- call — e.g. GET /rest/v1/games?select=lobby_code — completely bypassing
-- the app UI, which never shows this to a signed-out visitor. Confirmed
-- live: `set local role anon; select lobby_code from games where id=...`
-- returned a real code before this fix.
--
-- A column-level REVOKE alone does NOT work here and was tried first:
-- Postgres only lets a column-level REVOKE narrow a column-level GRANT.
-- Against a pre-existing whole-table GRANT SELECT (what anon already had),
-- it's a no-op — the table-level grant still covers every column
-- regardless. The only way to actually wall off one column is to revoke
-- the whole-table privilege and re-grant SELECT on just the safe column
-- list. Verified post-fix: selecting lobby_code as anon now raises
-- `permission denied for table games/fixtures`; every other column (and
-- the authenticated role, untouched here) still reads normally.
revoke select on games from anon;
grant select (
  id, league_id, game_number, scheduled_at, status, lineup_locked_at,
  round_number, map, observer_id, observer_stream_live,
  observer_stream_title, observer_stream_viewers, observer_stream_checked_at
) on games to anon;

revoke select on fixtures from anon;
grant select (
  id, league_id, round_number, scheduled_at, best_of, home_team_id,
  away_team_id, status, lineup_locked_at, winner_team_id, home_score,
  away_score, observer_id, observer_stream_live, observer_stream_title,
  observer_stream_viewers, observer_stream_checked_at
) on fixtures to anon;
