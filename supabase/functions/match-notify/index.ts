// match-notify — BUILD.md §5. Two triggers call this (see
// 20260914131000_match_notify_triggers.sql via pg_net, fire-and-forget):
//  - "new_match": games AFTER INSERT, when the league is published.
//  - "lock_soon": the same cron tick that locks a game's lineups at T-10m
//    (BUILD.md: "this notification also represents the moment team
//    lineups lock for that game" — one moment, one push).
// Recipients are every member of every team approved for the league;
// lock_soon additionally excludes anyone who muted that specific game
// (screen 07's per-game bell — notification_prefs).
import { createClient } from "jsr:@supabase/supabase-js@2";

type NotifyBody = { type: "new_match" | "lock_soon"; gameId: string };

Deno.serve(async (req: Request) => {
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: game } = await supabase
    .from("games")
    .select("id, round_number, game_number, scheduled_at, map, lobby_code, league_id, leagues(name)")
    .eq("id", body.gameId)
    .single();

  if (!game) {
    return new Response(JSON.stringify({ ok: false, error: "game not found" }), { status: 404 });
  }

  const leagueName = (game.leagues as any)?.name ?? "your league";
  const when = new Date(game.scheduled_at).toLocaleString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { data: approvedTeams } = await supabase
    .from("league_teams")
    .select("team_id")
    .eq("league_id", game.league_id)
    .eq("status", "approved");
  const teamIds = (approvedTeams ?? []).map((t) => t.team_id);
  if (teamIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, recipients: 0 }));
  }

  const { data: members } = await supabase.from("team_members").select("profile_id").in("team_id", teamIds);
  let profileIds = [...new Set((members ?? []).map((m) => m.profile_id))];

  if (body.type === "lock_soon") {
    const { data: muted } = await supabase
      .from("notification_prefs")
      .select("profile_id")
      .eq("game_id", game.id)
      .eq("muted", true);
    const mutedSet = new Set((muted ?? []).map((m) => m.profile_id));
    profileIds = profileIds.filter((id) => !mutedSet.has(id));
  }

  if (profileIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, recipients: 0 }));
  }

  const { data: tokens } = await supabase.from("push_tokens").select("token").in("profile_id", profileIds);
  const pushTokens = [...new Set((tokens ?? []).map((t) => t.token))];
  if (pushTokens.length === 0) {
    return new Response(JSON.stringify({ ok: true, recipients: profileIds.length, tokens: 0 }));
  }

  const matchLabel = `Match ${game.round_number} · Game ${game.game_number}`;
  const deepLinkUrl = `beacon://games/${game.id}/lobby`;

  const { title, message, data } =
    body.type === "new_match"
      ? {
          title: "New game scheduled",
          message: `${leagueName} added ${matchLabel} — ${when}${game.map ? `, ${game.map}` : ""}. 20-team lobby.`,
          data: { url: `beacon://games` },
        }
      : {
          title: "Lobby opens in 10 minutes",
          message: `${matchLabel} · ${leagueName}. Lineups are locked as of now. Tap to open your lobby code.`,
          data: { url: deepLinkUrl },
        };

  // Expo Push API accepts up to 100 messages per request.
  const chunks: string[][] = [];
  for (let i = 0; i < pushTokens.length; i += 100) chunks.push(pushTokens.slice(i, i + 100));

  let sent = 0;
  for (const chunk of chunks) {
    const messages = chunk.map((to) => ({ to, title, body: message, data, sound: "default" }));
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (res.ok) sent += chunk.length;
      else console.error("match-notify: Expo push API returned", res.status, await res.text());
    } catch (err) {
      console.error("match-notify: Expo push API request failed", err);
    }
  }

  return new Response(JSON.stringify({ ok: true, recipients: profileIds.length, tokens: pushTokens.length, sent }));
});
