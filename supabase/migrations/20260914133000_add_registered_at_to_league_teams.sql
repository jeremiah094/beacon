alter table league_teams add column registered_at timestamptz not null default now();
