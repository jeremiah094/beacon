-- Revoking from PUBLIC in the previous migration also removed service_role's
-- inherited access — it needs its own explicit grant to call this via RPC
-- from the lineup-lock Edge Function.
grant execute on function lock_overdue_lineups() to service_role;
