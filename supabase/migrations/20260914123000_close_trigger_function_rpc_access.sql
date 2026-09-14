-- Trigger functions fire via the trigger mechanism, not a direct call, so
-- revoking EXECUTE here doesn't affect the on_auth_user_created trigger —
-- it only closes the accidental public RPC surface at /rpc/handle_new_auth_user.
revoke execute on function handle_new_auth_user() from anon, authenticated;

-- Postgres grants EXECUTE to PUBLIC by default at function creation, which
-- anon/authenticated inherit regardless of the role-specific revoke above.
revoke execute on function handle_new_auth_user() from public;
