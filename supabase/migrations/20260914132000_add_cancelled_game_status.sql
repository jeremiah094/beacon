alter table games drop constraint games_status_check;
alter table games add constraint games_status_check
  check (status in ('scheduled','lobby_open','in_progress','completed','cancelled'));
