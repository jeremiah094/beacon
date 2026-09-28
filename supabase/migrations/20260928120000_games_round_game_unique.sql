-- A match (round_number) can never have two games sharing the same game
-- number — enforced at the DB level, not just client-side, matching the
-- teams_name_unique / leagues_name_season_unique precedent. Partial (not
-- a plain unique constraint) and scoped to `status != 'cancelled'`, same
-- pattern as team_join_requests_one_pending: a cancelled game's row is
-- kept (not deleted), but shouldn't permanently block re-scheduling that
-- same match/game slot.
create unique index games_league_round_game_unique on games (league_id, round_number, game_number) where status != 'cancelled';
