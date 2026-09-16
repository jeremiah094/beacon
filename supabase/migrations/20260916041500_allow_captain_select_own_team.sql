-- Real root cause of the create-team 403: PostgREST's INSERT ... RETURNING
-- (driven by the client's .select('id') after insert) requires the newly
-- inserted row to also pass the table's SELECT policy, not just the
-- INSERT policy's WITH CHECK. teams_select only allowed
-- is_team_member(id) OR is_admin() — but a brand-new team has no
-- team_members row yet (that insert happens next, client-side), so the
-- read-back always failed RLS even though captain_id = auth.uid() was
-- correct the whole time (confirmed via a temporary debug trigger that
-- logged captain_id/auth.uid()/match=true on every real attempt).
-- The real fix: a team's captain should always be able to see their own
-- team by ownership, independent of team_members rows existing.

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (private.is_team_member(id) or private.is_admin() or captain_id = auth.uid());
