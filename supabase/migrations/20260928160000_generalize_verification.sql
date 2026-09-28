-- Generalizes player verification off Apex/EA-specific flat columns onto
-- a per-title game_accounts table, so Valorant (and later CS2/Rocket
-- League) can each have their own linked ID/stats without special-casing
-- profiles. Mirrors player_stats's exact shape and security posture —
-- only the service-role Edge Functions ever write this table, same as
-- player_stats before it ("No write policies").
create table game_accounts (
  profile_id uuid not null references profiles(id) on delete cascade,
  title_id uuid not null references titles(id),
  external_uid text not null,   -- EA ID, Riot ID, Steam ID, Epic ID — title-specific
  platform text,                -- nullable, title-specific (Apex: PC/X1/PS4; others: n/a or region)
  verified_at timestamptz,
  rank_name text,
  rank_score int,
  kd numeric,
  wins int,
  kills int,
  most_played_legend text,      -- Apex-named historically; read loosely as "most played pick" for other titles
  level int,
  raw jsonb,
  fetched_at timestamptz,
  primary key (profile_id, title_id)
);

create index on game_accounts (profile_id);

alter table game_accounts enable row level security;
create policy game_accounts_select on game_accounts for select
  using (private.shares_context(profile_id) or private.is_admin());
-- No write policy for authenticated/anon, matching player_stats before it.

-- Migrate existing Apex verification data in one pass.
insert into game_accounts (profile_id, title_id, external_uid, platform, verified_at, rank_name, rank_score, kd, wins, kills, most_played_legend, level, raw, fetched_at)
select p.id, (select id from titles where slug = 'apex'), p.apex_uid, p.apex_platform, p.apex_verified_at,
       ps.rank_name, ps.rank_score, ps.kd, ps.wins, ps.kills, ps.most_played_legend, ps.level, ps.raw, ps.fetched_at
from profiles p
left join player_stats ps on ps.profile_id = p.id
where p.apex_uid is not null;

drop table player_stats;
alter table profiles drop column apex_uid;
alter table profiles drop column apex_platform;
alter table profiles drop column apex_verified_at;
