-- Missing FK covering indexes.
create index on league_teams (decided_by);
create index on leagues (created_by);
create index on notification_prefs (game_id);
create index on results (entered_by);
create index on substitutions (applied_by);
create index on substitutions (in_profile_id);
create index on substitutions (out_profile_id);
create index on substitutions (team_id);
create index on teams (captain_id);

-- auth.<fn>() in a policy is re-evaluated per row unless wrapped so the
-- planner can hoist it into an InitPlan (evaluated once per statement).
drop policy profiles_insert_self on profiles;
create policy profiles_insert_self on profiles for insert
  with check (id = (select auth.uid()));

drop policy profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy teams_insert on teams;
create policy teams_insert on teams for insert
  with check (captain_id = (select auth.uid()));

drop policy teams_update on teams;
create policy teams_update on teams for update
  using (captain_id = (select auth.uid()))
  with check (captain_id = (select auth.uid()));

drop policy teams_delete on teams;
create policy teams_delete on teams for delete
  using (captain_id = (select auth.uid()));

drop policy notification_prefs_owner on notification_prefs;
create policy notification_prefs_owner on notification_prefs for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy push_tokens_owner on push_tokens;
create policy push_tokens_owner on push_tokens for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Split the "_write ... for all" policies so SELECT isn't covered twice
-- (once by the dedicated _select policy, once by "all").
drop policy games_write on games;
create policy games_insert on games for insert with check (private.is_admin());
create policy games_update on games for update using (private.is_admin()) with check (private.is_admin());
create policy games_delete on games for delete using (private.is_admin());

drop policy leagues_write on leagues;
create policy leagues_insert on leagues for insert with check (private.is_admin());
create policy leagues_update on leagues for update using (private.is_admin()) with check (private.is_admin());
create policy leagues_delete on leagues for delete using (private.is_admin());

drop policy results_write on results;
create policy results_insert on results for insert with check (private.is_admin());
create policy results_update on results for update using (private.is_admin()) with check (private.is_admin());
create policy results_delete on results for delete using (private.is_admin());

drop policy team_members_write on team_members;
create policy team_members_insert on team_members for insert with check (private.is_team_captain(team_id));
create policy team_members_update on team_members for update using (private.is_team_captain(team_id)) with check (private.is_team_captain(team_id));
create policy team_members_delete on team_members for delete using (private.is_team_captain(team_id));

drop policy lineup_players_write on lineup_players;
create policy lineup_players_insert on lineup_players for insert with check (private.can_edit_lineup(lineup_id));
create policy lineup_players_delete on lineup_players for delete using (private.can_edit_lineup(lineup_id));
