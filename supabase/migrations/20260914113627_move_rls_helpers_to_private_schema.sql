-- Undo the over-broad revoke — RLS policies call these as the querying
-- role, so revoking authenticated's EXECUTE broke every policy that uses
-- them. The actual fix for "don't expose these as public RPCs" is to move
-- them out of `public` (which PostgREST exposes) into a schema it doesn't
-- serve — internal SQL/RLS evaluation can still reach any schema.
grant execute on function is_admin() to anon, authenticated;
grant execute on function is_team_member(uuid) to anon, authenticated;
grant execute on function is_team_captain(uuid) to anon, authenticated;
grant execute on function shares_context(uuid) to anon, authenticated;
grant execute on function can_edit_lineup(uuid) to anon, authenticated;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function private.is_team_member(p_team_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from team_members tm where tm.team_id = p_team_id and tm.profile_id = auth.uid()
  );
$$;

create or replace function private.is_team_captain(p_team_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from teams t where t.id = p_team_id and t.captain_id = auth.uid()
  );
$$;

create or replace function private.shares_context(p_other uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    p_other = auth.uid()
    or exists (
      select 1 from team_members tm1
      join team_members tm2 on tm1.team_id = tm2.team_id
      where tm1.profile_id = auth.uid() and tm2.profile_id = p_other
    )
    or exists (
      select 1
      from team_members tm_self
      join league_teams lt_self on lt_self.team_id = tm_self.team_id
      join league_teams lt_other on lt_other.league_id = lt_self.league_id
      join team_members tm_other on tm_other.team_id = lt_other.team_id
      where tm_self.profile_id = auth.uid() and tm_other.profile_id = p_other
    );
$$;

create or replace function private.can_edit_lineup(p_lineup_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from lineups l
    join games g on g.id = l.game_id
    where l.id = p_lineup_id
      and private.is_team_captain(l.team_id)
      and l.locked_at is null
      and now() < g.scheduled_at - interval '10 minutes'
  );
$$;

grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_team_member(uuid) to anon, authenticated;
grant execute on function private.is_team_captain(uuid) to anon, authenticated;
grant execute on function private.shares_context(uuid) to anon, authenticated;
grant execute on function private.can_edit_lineup(uuid) to anon, authenticated;

-- Repoint every policy at the private.* versions.
drop policy profiles_select on profiles;
create policy profiles_select on profiles for select
  using (private.shares_context(id) or private.is_admin());

drop policy player_stats_select on player_stats;
create policy player_stats_select on player_stats for select
  using (private.shares_context(profile_id) or private.is_admin());

drop policy teams_select on teams;
create policy teams_select on teams for select
  using (private.is_team_member(id) or private.is_admin());

drop policy team_members_select on team_members;
create policy team_members_select on team_members for select
  using (private.is_team_member(team_id) or private.is_admin());

drop policy team_members_write on team_members;
create policy team_members_write on team_members for all
  using (private.is_team_captain(team_id))
  with check (private.is_team_captain(team_id));

drop policy league_teams_select on league_teams;
create policy league_teams_select on league_teams for select
  using (private.is_team_member(team_id) or private.is_admin());

drop policy league_teams_insert on league_teams;
create policy league_teams_insert on league_teams for insert
  with check (private.is_team_captain(team_id));

drop policy league_teams_decide on league_teams;
create policy league_teams_decide on league_teams for update
  using (private.is_admin())
  with check (private.is_admin());

drop policy leagues_select on leagues;
create policy leagues_select on leagues for select
  using (status = 'published' or private.is_admin());

drop policy leagues_write on leagues;
create policy leagues_write on leagues for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy games_select on games;
create policy games_select on games for select
  using (
    private.is_admin()
    or exists (select 1 from leagues l where l.id = games.league_id and l.status = 'published')
  );

drop policy games_write on games;
create policy games_write on games for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy results_select on results;
create policy results_select on results for select
  using (
    private.is_admin()
    or exists (
      select 1 from games g join leagues l on l.id = g.league_id
      where g.id = results.game_id and l.status = 'published'
    )
  );

drop policy results_write on results;
create policy results_write on results for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy lineups_select on lineups;
create policy lineups_select on lineups for select
  using (private.is_team_member(team_id) or private.is_admin());

drop policy lineups_insert on lineups;
create policy lineups_insert on lineups for insert
  with check (
    private.is_team_captain(team_id)
    and exists (
      select 1 from games g
      where g.id = lineups.game_id and now() < g.scheduled_at - interval '10 minutes'
    )
  );

drop policy lineups_update on lineups;
create policy lineups_update on lineups for update
  using (private.can_edit_lineup(id))
  with check (
    private.is_team_captain(team_id)
    and exists (
      select 1 from games g
      where g.id = lineups.game_id and now() < g.scheduled_at - interval '10 minutes'
    )
  );

drop policy lineup_players_select on lineup_players;
create policy lineup_players_select on lineup_players for select
  using (
    private.is_admin()
    or exists (select 1 from lineups l where l.id = lineup_players.lineup_id and private.is_team_member(l.team_id))
  );

drop policy lineup_players_write on lineup_players;
create policy lineup_players_write on lineup_players for all
  using (private.can_edit_lineup(lineup_id))
  with check (private.can_edit_lineup(lineup_id));

drop policy substitutions_select on substitutions;
create policy substitutions_select on substitutions for select
  using (private.is_team_member(team_id) or private.is_admin());

drop policy substitutions_insert on substitutions;
create policy substitutions_insert on substitutions for insert
  with check (private.is_admin());

-- Now safe to drop the old public.* copies and close direct RPC access.
drop function is_admin();
drop function is_team_member(uuid);
drop function is_team_captain(uuid);
drop function shares_context(uuid);
drop function can_edit_lineup(uuid);
