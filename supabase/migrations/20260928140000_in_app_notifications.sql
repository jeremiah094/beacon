-- In-app notification inbox — a fallback for players who never enabled
-- (or later revoked) OS push permission. match-notify writes one row per
-- recipient here unconditionally, alongside whatever push channels that
-- recipient actually has tokens for, so the in-app record always exists
-- regardless of push status.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The notification bell's unread badge and the inbox list are both
-- "unread first / most recent first" queries against one profile.
create index on notifications (profile_id, created_at desc);
create index on notifications (profile_id) where read_at is null;

alter table notifications enable row level security;

-- Read/mark-as-read only — no insert/delete policy for authenticated:
-- every row is written by match-notify's service-role client, matching
-- how push_tokens rows aren't meant to be authored by arbitrary clients
-- either. A user can only ever update their own rows' read_at.
create policy notifications_select on notifications
  for select using (profile_id = auth.uid());

create policy notifications_update on notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
