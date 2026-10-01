-- Apex equivalent of fixtures.observer_id — Apex custom lobbies allow up
-- to 5 observer slots (vs Riot's 2), and Beacon's Apex side already has
-- lobby_code + the Monitor screen, so this is a narrower addition than
-- the Valorant build: just who's watching, reusing the same
-- admin-enforcement pattern.
--
-- Generalizes the enforcement trigger (previously fixture-only) into one
-- function reused by both tables, since the check only ever touches
-- NEW.observer_id — no reason to duplicate it per table.
create or replace function enforce_observer_is_admin()
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

drop trigger fixtures_observer_is_admin on fixtures;
create trigger fixtures_observer_is_admin
  before insert or update on fixtures
  for each row
  execute function enforce_observer_is_admin();

drop function enforce_fixture_observer_is_admin();

alter table games add column observer_id uuid references profiles(id);

create trigger games_observer_is_admin
  before insert or update on games
  for each row
  execute function enforce_observer_is_admin();
