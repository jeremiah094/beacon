-- Tracks whether an admin has manually marked a team as present in the
-- private Apex lobby for a game. This is admin-entered, not read from
-- Apex — apexlegendsapi.com has no live custom-lobby-presence endpoint,
-- so there's no automatic way to know who's actually in the lobby.
create table lobby_presence (
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  status text not null check (status in ('in_lobby', 'no')),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (game_id, team_id)
);

create index on lobby_presence (game_id);

alter table lobby_presence enable row level security;

-- Admin-only, both read and write — only the Monitor screen shows this,
-- and only an admin can set it (matches the request: "can only be
-- updated and edited by the admin").
create policy lobby_presence_admin_all on lobby_presence for all
  using (private.is_admin())
  with check (private.is_admin());
