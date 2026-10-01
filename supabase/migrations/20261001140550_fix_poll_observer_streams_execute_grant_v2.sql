-- The prior migration revoked from anon/authenticated specifically, but
-- Postgres grants EXECUTE on a new function to PUBLIC by default — and
-- anon/authenticated inherit through PUBLIC unless PUBLIC itself is
-- revoked too. lock_overdue_lineups() (20260914125000) already has this
-- correct ACL; this brings poll_observer_streams() in line with it.
revoke execute on function poll_observer_streams() from public;
grant execute on function poll_observer_streams() to postgres, service_role;
