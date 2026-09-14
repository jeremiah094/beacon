-- "Round N · Match N" is the standard copy across screens 02, 07, 09, etc.
-- game_number is the match number within a round; round_number groups games.
alter table games add column round_number int not null default 1;
