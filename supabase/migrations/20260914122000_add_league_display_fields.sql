-- Presentational fields the league hub / create-league screens need that
-- BUILD.md's schema didn't carry: season label ("Season 3") and entry
-- eligibility copy ("3 players per team · Diamond and above").
alter table leagues add column season_label text;
alter table leagues add column entry_rules text;
