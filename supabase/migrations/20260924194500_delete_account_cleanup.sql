-- Resolves every non-cascading foreign key into profiles(id) for a user
-- who is deleting their own account, so the subsequent auth.users delete
-- (issued by the delete-account Edge Function via the Admin API) can
-- cascade cleanly through every ON DELETE CASCADE table without hitting a
-- foreign key violation. This function does NOT delete profiles or
-- auth.users itself — that cascade happens once auth.users is removed.
--
-- Callable only by service_role: the delete-account Edge Function derives
-- p_profile_id from the caller's own verified JWT (auth.getUser()), never
-- from client-supplied input, so unlike admin_remove_team_from_league
-- (invoked directly by client RPC), this function doesn't need to
-- self-check identity — the edge function already did.
create or replace function delete_account_cleanup(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    raise exception 'p_profile_id is required';
  end if;

  -- Block deletion if the user captains any team that has other members —
  -- deleting their account would silently strip those teammates of their
  -- team, and there's no "transfer captaincy" or "remove teammate" feature
  -- to fall back on. They must delete that team themselves first (a right
  -- captains already have) or wait for members to leave.
  if exists (
    select 1
    from teams t
    where t.captain_id = p_profile_id
      and exists (
        select 1 from team_members tm
        where tm.team_id = t.id and tm.profile_id != p_profile_id
      )
  ) then
    raise exception 'You captain a team with other members. Delete that team (or have everyone else leave) before deleting your account.';
  end if;

  -- Any team captained solely by this user (no other members) can be
  -- deleted outright — mirrors the existing captain delete-team RLS
  -- policy, and no one else is affected. Cascades through team_members,
  -- league_teams, lineups -> lineup_players, substitutions, results,
  -- substitution_requests, team_join_requests, lobby_presence — all
  -- already `on delete cascade` on teams(id).
  delete from teams where captain_id = p_profile_id;

  -- Pending/historical substitution requests where this user is the sub
  -- target or requester on a team they do NOT captain (their own team's
  -- requests are already gone via the team delete above). These columns
  -- are not null, so they can't be nulled — only removed.
  delete from substitution_requests
  where out_profile_id = p_profile_id
     or in_profile_id = p_profile_id
     or requested_by = p_profile_id;

  -- Attribution-only columns (nullable, never referenced by any RLS policy
  -- or authorization check) — null them out so leagues/games/match history
  -- survive with the identifying reference removed.
  update leagues set created_by = null where created_by = p_profile_id;
  update league_teams set decided_by = null where decided_by = p_profile_id;
  update substitutions
  set out_profile_id = case when out_profile_id = p_profile_id then null else out_profile_id end,
      in_profile_id = case when in_profile_id = p_profile_id then null else in_profile_id end,
      applied_by = case when applied_by = p_profile_id then null else applied_by end
  where out_profile_id = p_profile_id or in_profile_id = p_profile_id or applied_by = p_profile_id;
  update results set entered_by = null where entered_by = p_profile_id;
  update lobby_presence set updated_by = null where updated_by = p_profile_id;
  update substitution_requests set decided_by = null where decided_by = p_profile_id;
end;
$$;

revoke all on function delete_account_cleanup(uuid) from public;
revoke all on function delete_account_cleanup(uuid) from anon, authenticated;
grant execute on function delete_account_cleanup(uuid) to service_role;
