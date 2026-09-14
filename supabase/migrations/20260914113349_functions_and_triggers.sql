-- ALGS placement points (BUILD.md §2 scoring table). Standings are computed
-- in the database, not the client.
create or replace function placement_points(p_placement int)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when p_placement = 1 then 12
    when p_placement = 2 then 9
    when p_placement = 3 then 7
    when p_placement = 4 then 5
    when p_placement = 5 then 4
    when p_placement between 6 and 7 then 3
    when p_placement between 8 and 10 then 2
    when p_placement between 11 and 15 then 1
    when p_placement between 16 and 20 then 0
    else 0
  end
$$;

-- team_members: max 5 players per team, max 3 teams per profile.
create or replace function enforce_team_member_limits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from team_members where team_id = new.team_id) >= 5 then
    raise exception 'Team % already has the maximum of 5 players', new.team_id
      using errcode = 'check_violation';
  end if;
  if (select count(*) from team_members where profile_id = new.profile_id) >= 3 then
    raise exception 'Profile % is already on the maximum of 3 teams', new.profile_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger team_members_enforce_limits
  before insert on team_members
  for each row execute function enforce_team_member_limits();

-- lineups: exactly 3 lineup_players rows are required before confirmed_at
-- can be set (Apex trios).
create or replace function enforce_lineup_confirm_requires_three()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.confirmed_at is not null and old.confirmed_at is null then
    if (select count(*) from lineup_players where lineup_id = new.id) <> 3 then
      raise exception 'Lineup % must have exactly 3 players to confirm', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger lineups_enforce_confirm_requires_three
  before update on lineups
  for each row execute function enforce_lineup_confirm_requires_three();
