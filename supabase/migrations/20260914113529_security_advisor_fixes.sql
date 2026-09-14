-- Pin search_path on the three functions created before that convention.
alter function placement_points(int) set search_path = public;
alter function enforce_team_member_limits() set search_path = public;
alter function enforce_lineup_confirm_requires_three() set search_path = public;

-- Views default to running with the creator's privileges unless told
-- otherwise; make it run as the querying user so RLS on the underlying
-- tables (results, games) still applies.
alter view standings set (security_invoker = true);

-- These SECURITY DEFINER helpers exist only for RLS policies to call
-- internally (policy evaluation isn't gated by function EXECUTE grants) —
-- they were never meant to be public RPC endpoints.
revoke execute on function is_admin() from anon, authenticated;
revoke execute on function is_team_member(uuid) from anon, authenticated;
revoke execute on function is_team_captain(uuid) from anon, authenticated;
revoke execute on function shares_context(uuid) from anon, authenticated;
revoke execute on function can_edit_lineup(uuid) from anon, authenticated;
