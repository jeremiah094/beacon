-- "Have an observer in every custom match" — a fixture's assigned admin
-- (who joins the Riot custom lobby as Observer and watches the match) plus
-- the lobby code they set up, mirroring Apex's games.lobby_code. Riot's
-- client has no API to create/manage custom lobbies, so this is purely a
-- coordination record on Beacon's side, not a grant of any new DB
-- permission — observer_id must already be an admin (is_admin=true),
-- enforced below, not a new lighter-weight role.
alter table fixtures
  add column observer_id uuid references profiles(id),
  add column lobby_code text;

create or replace function enforce_fixture_observer_is_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.observer_id is not null and not exists (
    select 1 from profiles where id = new.observer_id and is_admin = true
  ) then
    raise exception 'The assigned observer must be an admin.';
  end if;
  return new;
end;
$$;

create trigger fixtures_observer_is_admin
  before insert or update on fixtures
  for each row
  execute function enforce_fixture_observer_is_admin();
