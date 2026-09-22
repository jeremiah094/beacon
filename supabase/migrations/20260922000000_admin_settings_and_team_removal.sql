-- League-wide defaults the admin console's Settings screen edits: default
-- region / teams-per-lobby / map pool for new leagues and scheduling.
-- Singleton table (id is always `true`, so only one row can ever exist).
create table league_defaults (
  id boolean primary key default true,
  default_region text not null default 'Ireland-wide',
  default_teams_per_lobby int not null default 20,
  default_maps text[] not null default array['Storm Point', 'World''s Edge', 'Broken Moon', 'Olympus'],
  constraint league_defaults_singleton check (id)
);

insert into league_defaults (id) values (true);

alter table league_defaults enable row level security;

create policy league_defaults_admin_all on league_defaults for all
  using (private.is_admin())
  with check (private.is_admin());

-- Removing a team from a league needs coordinated deletes across
-- lineups/lineup_players/substitutions/results/league_teams — several of
-- which have no admin DELETE policy at all (not just no matching row).
-- A security definer function is atomic and self-checks admin status
-- (required since security definer bypasses RLS) rather than adding four
-- new table-level policies for a single, low-frequency admin action.
create or replace function admin_remove_team_from_league(p_league_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can remove a team from a league' using errcode = '42501';
  end if;

  delete from substitutions
  where team_id = p_team_id
    and game_id in (select id from games where league_id = p_league_id);

  delete from results
  where team_id = p_team_id
    and game_id in (select id from games where league_id = p_league_id);

  delete from lineups
  where team_id = p_team_id
    and game_id in (select id from games where league_id = p_league_id);

  delete from league_teams
  where league_id = p_league_id
    and team_id = p_team_id;
end;
$$;

grant execute on function admin_remove_team_from_league(uuid, uuid) to authenticated;
