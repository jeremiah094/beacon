create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gamertag text unique,
  display_name text,
  apex_uid text,
  apex_platform text check (apex_platform in ('PC','X1','PS4')),
  apex_verified_at timestamptz,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table player_stats (
  profile_id uuid primary key references profiles(id) on delete cascade,
  rank_name text,
  rank_score int,
  kd numeric,
  wins int,
  most_played_legend text,
  level int,
  raw jsonb,
  fetched_at timestamptz
);

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default 'Ireland',
  format text not null default 'battle_royale',
  teams_per_lobby int not null default 20,
  season_start date,
  season_end date,
  status text not null default 'draft' check (status in ('draft','published','completed')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text,
  captain_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('captain','member','sub')),
  joined_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create table league_teams (
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  primary key (league_id, team_id)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  game_number int not null,
  scheduled_at timestamptz not null,
  lobby_code text,
  status text not null default 'scheduled' check (status in ('scheduled','lobby_open','in_progress','completed')),
  lineup_locked_at timestamptz
);

create table lineups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  confirmed_at timestamptz,
  locked_at timestamptz,
  unique (game_id, team_id)
);

create table lineup_players (
  lineup_id uuid not null references lineups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (lineup_id, profile_id)
);

create table substitutions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  out_profile_id uuid references profiles(id),
  in_profile_id uuid references profiles(id),
  reason text,
  applied_by uuid references profiles(id),
  applied_at timestamptz not null default now()
);

create table results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  placement int,
  kills int,
  source text not null default 'manual' check (source in ('api','manual')),
  entered_by uuid references profiles(id),
  published_at timestamptz,
  unique (game_id, team_id)
);

create table notification_prefs (
  profile_id uuid not null references profiles(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  muted boolean not null default false,
  primary key (profile_id, game_id)
);

create table push_tokens (
  profile_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text,
  primary key (profile_id, token)
);

create index on player_stats (profile_id);
create index on team_members (profile_id);
create index on league_teams (team_id);
create index on games (league_id, scheduled_at);
create index on lineups (team_id);
create index on lineup_players (profile_id);
create index on results (team_id);
create index on substitutions (game_id, team_id);
