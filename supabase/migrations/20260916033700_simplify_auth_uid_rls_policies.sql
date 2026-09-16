-- Replace "(select auth.uid())" with plain "auth.uid()" in RLS policies.
-- The wrapped form is a Postgres/PostgREST-recommended optimization for
-- policies evaluated over many rows (it lets Postgres cache the call once
-- per statement instead of once per row). For a single-row INSERT/UPDATE
-- check it buys nothing, and repeated production 42501s on teams_insert
-- (row-level security violation, JWT subject verified correct in
-- edge_logs, and the same predicate independently verified TRUE via SQL)
-- point at a stale-plan/InitPlan-caching interaction with that pattern on
-- pooled connections. Removing the SELECT wrapper removes the scalar
-- subquery Postgres could cache across executions of a reused plan.

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists teams_insert on public.teams;
create policy teams_insert on public.teams
  for insert with check (captain_id = auth.uid());

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams
  for update using (captain_id = auth.uid()) with check (captain_id = auth.uid());

drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams
  for delete using (captain_id = auth.uid());

drop policy if exists notification_prefs_owner on public.notification_prefs;
create policy notification_prefs_owner on public.notification_prefs
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists substitution_requests_insert on public.substitution_requests;
create policy substitution_requests_insert on public.substitution_requests
  for insert with check (private.is_team_captain(team_id) and requested_by = auth.uid());
