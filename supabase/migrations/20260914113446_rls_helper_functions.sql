-- SECURITY DEFINER helpers so RLS policies can check membership/role without
-- re-triggering RLS on the tables they query (avoids recursive-policy traps).

create or replace function is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function is_team_member(p_team_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from team_members tm where tm.team_id = p_team_id and tm.profile_id = auth.uid()
  );
$$;

create or replace function is_team_captain(p_team_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from teams t where t.id = p_team_id and t.captain_id = auth.uid()
  );
$$;

-- profiles visibility: self, or anyone sharing a team, or anyone sharing a
-- league via team registrations (BUILD.md §3 RLS: "read own + any profile
-- sharing a team or league").
create or replace function shares_context(p_other uuid)
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

-- lineup write window: captain, unlocked, strictly before T-10m (BUILD.md
-- §3 & §9: enforced in the policy, not just the UI).
create or replace function can_edit_lineup(p_lineup_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from lineups l
    join games g on g.id = l.game_id
    where l.id = p_lineup_id
      and is_team_captain(l.team_id)
      and l.locked_at is null
      and now() < g.scheduled_at - interval '10 minutes'
  );
$$;
