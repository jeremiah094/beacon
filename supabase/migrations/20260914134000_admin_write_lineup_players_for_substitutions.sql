-- Admin approval of an emergency substitution request (screen 14) needs to
-- write lineup_players for a lineup that is, by definition, already locked
-- (that's exactly when a captain's own edit window is closed) — the
-- existing can_edit_lineup()-gated policy can never allow that. Add a
-- separate admin-only permissive policy alongside it.
create policy lineup_players_admin_write on lineup_players for all
  using (private.is_admin())
  with check (private.is_admin());
