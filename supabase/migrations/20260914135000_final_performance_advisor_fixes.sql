-- Missing FK index flagged by the performance advisor.
create index on substitution_requests (team_id);

-- Fold the admin-only lineup_players policy (added for screen 14's
-- emergency-substitution approval) into the existing per-action
-- policies instead of layering a separate permissive policy on top —
-- same access, one policy evaluated per action instead of two.
drop policy lineup_players_admin_write on lineup_players;

drop policy lineup_players_insert on lineup_players;
create policy lineup_players_insert on lineup_players for insert
  with check (private.is_admin() or private.can_edit_lineup(lineup_id));

drop policy lineup_players_delete on lineup_players;
create policy lineup_players_delete on lineup_players for delete
  using (private.is_admin() or private.can_edit_lineup(lineup_id));
