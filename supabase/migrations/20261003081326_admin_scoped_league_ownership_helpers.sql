-- Three small reusable ownership checks, matching the existing
-- private.is_team_member()/private.is_league_teammate() style, used by
-- the RLS policy rewrite in 20261003161846_admin_scoped_league_ownership.sql
-- to scope admin access to the leagues an admin actually created.
create or replace function private.owns_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from leagues where id = p_league_id and created_by = auth.uid());
$$;

create or replace function private.owns_league_for_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from games g join leagues l on l.id = g.league_id
    where g.id = p_game_id and l.created_by = auth.uid()
  );
$$;

create or replace function private.owns_league_for_fixture(p_fixture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from fixtures f join leagues l on l.id = f.league_id
    where f.id = p_fixture_id and l.created_by = auth.uid()
  );
$$;
