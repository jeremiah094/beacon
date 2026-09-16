-- Captain should always be on their own team's roster. Previously this
-- relied on the client issuing a second insert into team_members right
-- after creating the team — if that second call ever failed (dropped
-- network, thrown error swallowed upstream) the team would exist with no
-- one on its roster. Do it server-side, in the same transaction as the
-- team insert, so it's guaranteed rather than best-effort. Mirrors the
-- handle_new_auth_user pattern for profiles.
create or replace function handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.captain_id is not null then
    insert into public.team_members (team_id, profile_id, role)
    values (new.id, new.captain_id, 'captain')
    on conflict (team_id, profile_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_team_created
  after insert on teams
  for each row execute function handle_new_team();
