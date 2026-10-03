-- Companion to 20261003161846_admin_scoped_league_ownership.sql.
-- admin_remove_team_from_league is SECURITY DEFINER (bypasses RLS
-- entirely) and only ever checked is_admin() — a real gap now that
-- leagues are creator-scoped: a non-owning admin who already knew
-- another league's id and a team id in it could still remove that team.
-- This adds the same created_by = auth.uid() check the RLS policies in
-- the companion migration now enforce everywhere else.
--
-- NOT YET APPLIED to the live project. CREATE OR REPLACE FUNCTION on
-- this specific function timed out across every mechanism tried in this
-- session — execute_sql, apply_migration, and a dynamic-SQL DO block —
-- while plain reads and every other DDL statement that session touched
-- (including three other CREATE OR REPLACE FUNCTION calls, and this
-- same statement issued earlier as a non-dynamic query) ran instantly
-- and pg_stat_activity showed no blocking locks throughout. That rules
-- out both a genuine Postgres lock wait and a DB-wide outage, pointing
-- at a narrower tool/infra-level issue scoped to this one statement.
-- The old, unpatched version remains active in the meantime — verified
-- intact, not corrupted, just missing this one ownership check.
--
-- Apply this file by hand once the tooling allows it.
create or replace function public.admin_remove_team_from_league(p_league_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can remove a team from a league' using errcode = '42501';
  end if;

  if not exists (select 1 from leagues where id = p_league_id and created_by = auth.uid()) then
    raise exception 'You can only manage leagues you created' using errcode = '42501';
  end if;

  delete from substitutions where team_id = p_team_id and game_id in (select id from games where league_id = p_league_id);
  delete from results where team_id = p_team_id and game_id in (select id from games where league_id = p_league_id);
  delete from lineups where team_id = p_team_id and game_id in (select id from games where league_id = p_league_id);
  delete from league_teams where league_id = p_league_id and team_id = p_team_id;
end;
$function$;
