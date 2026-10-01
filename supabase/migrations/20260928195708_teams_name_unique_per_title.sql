-- teams_name_unique was global (lower(name)) from before teams were
-- title-scoped — now that every team belongs to exactly one title
-- (teams.title_id), two unrelated orgs in different games shouldn't be
-- blocked from both calling their roster "Vipers". Scope the uniqueness
-- to (title_id, lower(name)) instead, matching how duplicate-name
-- prevention is scoped everywhere else in this schema (per-league, not
-- global).
drop index teams_name_unique;
create unique index teams_name_unique on teams (title_id, lower(name));
