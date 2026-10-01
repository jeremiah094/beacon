-- profiles.twitch_login/youtube_channel_id (observer_twitch_streaming.sql)
-- never got the column-level UPDATE grant that display_name/gamertag/
-- avatar_url already have for authenticated — ALTER TABLE ADD COLUMN
-- doesn't inherit an existing column-scoped GRANT. The profiles_update_self
-- RLS policy (id = auth.uid()) was fine; Postgres's column-privilege check
-- ran first and rejected it with "permission denied for table profiles",
-- which is why Save did nothing visible.
grant update (twitch_login, youtube_channel_id) on profiles to authenticated;
