-- profiles ------------------------------------------------------------
alter table profiles enable row level security;

create policy profiles_select on profiles for select
  using (shares_context(id) or is_admin());

create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid());

create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- is_admin (and the Apex-linked fields, which only apex-link-id/
-- apex-sync-stats via service role may set) are not client-settable.
revoke update on profiles from authenticated;
grant update (gamertag, display_name, avatar_url) on profiles to authenticated;

-- player_stats ---------------------------------------------------------
alter table player_stats enable row level security;

create policy player_stats_select on player_stats for select
  using (shares_context(profile_id) or is_admin());
-- No write policies: only the service-role Edge Functions write this table.

-- teams / team_members ---------------------------------------------------
alter table teams enable row level security;

create policy teams_select on teams for select
  using (is_team_member(id) or is_admin());

create policy teams_insert on teams for insert
  with check (captain_id = auth.uid());

create policy teams_update on teams for update
  using (captain_id = auth.uid())
  with check (captain_id = auth.uid());

create policy teams_delete on teams for delete
  using (captain_id = auth.uid());

alter table team_members enable row level security;

create policy team_members_select on team_members for select
  using (is_team_member(team_id) or is_admin());

create policy team_members_write on team_members for all
  using (is_team_captain(team_id))
  with check (is_team_captain(team_id));

-- league_teams -----------------------------------------------------------
alter table league_teams enable row level security;

create policy league_teams_select on league_teams for select
  using (is_team_member(team_id) or is_admin());

create policy league_teams_insert on league_teams for insert
  with check (is_team_captain(team_id));

create policy league_teams_decide on league_teams for update
  using (is_admin())
  with check (is_admin());

-- leagues / games / results: public read when published, admin write ----
alter table leagues enable row level security;

create policy leagues_select on leagues for select
  using (status = 'published' or is_admin());

create policy leagues_write on leagues for all
  using (is_admin())
  with check (is_admin());

alter table games enable row level security;

create policy games_select on games for select
  using (
    is_admin()
    or exists (select 1 from leagues l where l.id = games.league_id and l.status = 'published')
  );

create policy games_write on games for all
  using (is_admin())
  with check (is_admin());

alter table results enable row level security;

create policy results_select on results for select
  using (
    is_admin()
    or exists (
      select 1 from games g join leagues l on l.id = g.league_id
      where g.id = results.game_id and l.status = 'published'
    )
  );

create policy results_write on results for all
  using (is_admin())
  with check (is_admin());

-- lineups / lineup_players: the 10-minute cutoff, enforced here ----------
alter table lineups enable row level security;

create policy lineups_select on lineups for select
  using (is_team_member(team_id) or is_admin());

create policy lineups_insert on lineups for insert
  with check (
    is_team_captain(team_id)
    and exists (
      select 1 from games g
      where g.id = lineups.game_id and now() < g.scheduled_at - interval '10 minutes'
    )
  );

create policy lineups_update on lineups for update
  using (can_edit_lineup(id))
  with check (
    is_team_captain(team_id)
    and exists (
      select 1 from games g
      where g.id = lineups.game_id and now() < g.scheduled_at - interval '10 minutes'
    )
  );

alter table lineup_players enable row level security;

create policy lineup_players_select on lineup_players for select
  using (
    is_admin()
    or exists (select 1 from lineups l where l.id = lineup_players.lineup_id and is_team_member(l.team_id))
  );

create policy lineup_players_write on lineup_players for all
  using (can_edit_lineup(lineup_id))
  with check (can_edit_lineup(lineup_id));

-- substitutions: admin inserts, affected team + admins read --------------
alter table substitutions enable row level security;

create policy substitutions_select on substitutions for select
  using (is_team_member(team_id) or is_admin());

create policy substitutions_insert on substitutions for insert
  with check (is_admin());

-- notification_prefs / push_tokens: own rows only -------------------------
alter table notification_prefs enable row level security;

create policy notification_prefs_owner on notification_prefs for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table push_tokens enable row level security;

create policy push_tokens_owner on push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
