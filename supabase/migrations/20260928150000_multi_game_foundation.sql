-- Multi-game foundation, phase 1. Rather than 4 bespoke game engines, this
-- models 2 format families (battle_royale, head_to_head) each serving
-- multiple titles — format_type/roster_size/max_team_members/accent drive
-- branching and theming everywhere else without per-title special-casing.
-- Apex is the only title with real leagues today; Valorant/CS2/Rocket
-- League exist as rows from day one so the eventual head-to-head build is
-- config-and-screens, not another schema migration.
create table titles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  format_type text not null check (format_type in ('battle_royale', 'head_to_head')),
  roster_size int not null,       -- starting lineup: 3 (Apex, Rocket League), 5 (Valorant, CS2)
  max_team_members int not null,  -- bench cap
  accent text not null,
  accent_tint text not null,
  accent_border text not null
);

alter table titles enable row level security;
create policy titles_select on titles for select to authenticated using (true);

-- Accent/tint/border for Apex match theme/tokens.ts's existing `ember`
-- exactly — zero visual change for the current app. Valorant/CS2/Rocket
-- League are new, chosen distinct from ember and from each other and from
-- the `verified` teal-green token, evocative of each game without copying
-- any studio's exact trademarked hex.
insert into titles (slug, name, format_type, roster_size, max_team_members, accent, accent_tint, accent_border) values
  ('apex', 'Apex Legends', 'battle_royale', 3, 5, '#FF5A36', 'rgba(255,90,54,0.14)', 'rgba(255,90,54,0.4)'),
  ('valorant', 'Valorant', 'head_to_head', 5, 7, '#FF3B5C', 'rgba(255,59,92,0.14)', 'rgba(255,59,92,0.4)'),
  ('cs2', 'CS2', 'head_to_head', 5, 7, '#E89A3C', 'rgba(232,154,60,0.14)', 'rgba(232,154,60,0.4)'),
  ('rocket_league', 'Rocket League', 'head_to_head', 3, 5, '#3E8EF5', 'rgba(62,142,245,0.14)', 'rgba(62,142,245,0.4)');

-- Teams are one specific game's roster, not a cross-game org shell — an
-- org running both an Apex trio and a Valorant five-stack is two `teams`
-- rows, one per title. This is what keeps roster-size enforcement below
-- clean (one lookup, no ambiguity about which title's rules apply).
alter table teams add column title_id uuid references titles(id);
update teams set title_id = (select id from titles where slug = 'apex');
alter table teams alter column title_id set not null;

-- Replaces the dead `format` column (confirmed: written unconditionally
-- as 'battle_royale' by every league save regardless of any UI input,
-- never branched on anywhere in the app).
alter table leagues add column title_id uuid references titles(id);
update leagues set title_id = (select id from titles where slug = 'apex');
alter table leagues alter column title_id set not null;
alter table leagues drop column format;

-- A Valorant team can't accidentally register for an Apex league.
create or replace function enforce_league_teams_title_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_team_title uuid;
  v_league_title uuid;
begin
  select title_id into v_team_title from teams where id = new.team_id;
  select title_id into v_league_title from leagues where id = new.league_id;
  if v_team_title is distinct from v_league_title then
    raise exception 'This team plays a different game than this league' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger league_teams_enforce_title_match
  before insert on league_teams
  for each row execute function enforce_league_teams_title_match();

-- team_members: was a hardcoded "max 5 players per team" regardless of
-- title — now reads titles.max_team_members via the team's title_id, so
-- the same trigger serves every title without duplicating it. The
-- max-3-teams-per-profile rule is unchanged and title-agnostic.
create or replace function enforce_team_member_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_max_members int;
begin
  select t.max_team_members into v_max_members
  from teams tm join titles t on t.id = tm.title_id
  where tm.id = new.team_id;

  if (select count(*) from team_members where team_id = new.team_id) >= v_max_members then
    raise exception 'Team % already has the maximum of % players', new.team_id, v_max_members
      using errcode = 'check_violation';
  end if;
  if (select count(*) from team_members where profile_id = new.profile_id) >= 3 then
    raise exception 'Profile % is already on the maximum of 3 teams', new.profile_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- lineups: was a hardcoded "exactly 3" (Apex trios) — now reads
-- titles.roster_size via the lineup's team's title_id, so a Valorant
-- lineup requires 5, Rocket League requires 3, etc., all through the
-- same trigger. Function/trigger names kept as-is to avoid unrelated
-- churn on a live migration; the "_three" in the name is now historical.
create or replace function enforce_lineup_confirm_requires_three()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_roster_size int;
begin
  if new.confirmed_at is not null and old.confirmed_at is null then
    select t.roster_size into v_roster_size
    from teams tm join titles t on t.id = tm.title_id
    where tm.id = new.team_id;

    if (select count(*) from lineup_players where lineup_id = new.id) <> v_roster_size then
      raise exception 'Lineup % must have exactly % players to confirm', new.id, v_roster_size
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
