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
import webpush from "npm:web-push@3";

type NotifyBody = { type: "new_match" | "lock_soon"; gameId: string };

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const webPushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (webPushReady) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

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

  const { data: tokenRows } = await supabase.from("push_tokens").select("token, platform").in("profile_id", profileIds);
  const expoTokens = [...new Set((tokenRows ?? []).filter((t) => t.platform !== "web").map((t) => t.token))];
  const webTokens = [...new Set((tokenRows ?? []).filter((t) => t.platform === "web").map((t) => t.token))];

  const matchLabel = `Match ${game.round_number} · Game ${game.game_number}`;

  // Plain in-app paths, not a beacon:// scheme — native's deep-link handler
  // (useNotificationDeepLinks) already strips a beacon:// prefix if one is
  // there, so a bare path passes through unchanged, and the web service
  // worker's notificationclick handler uses the same path directly.
  const { title, message, data } =
    body.type === "new_match"
      ? {
          title: "New game scheduled",
          message: `${leagueName} added ${matchLabel} — ${when}${game.map ? `, ${game.map}` : ""}. 20-team lobby.`,
          data: { url: `/games` },
        }
      : {
          title: "Lobby opens in 10 minutes",
          message: `${matchLabel} · ${leagueName}. Lineups are locked as of now. Tap to open your lobby code.`,
          data: { url: `/games/${game.id}/lobby` },
        };

  let sent = 0;
  const staleTokens: string[] = [];
  const ticketErrors: { token: string; status: string; message?: string; error?: string }[] = [];

  // Expo Push API accepts up to 100 messages per request. Its response has
  // one "ticket" per message — the outer HTTP call can be 200 OK while an
  // individual ticket still reports a real delivery failure (a stale
  // token, misconfigured credentials, etc.), so those tickets are what
  // actually tells us whether anything reached a device.
  if (expoTokens.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < expoTokens.length; i += 100) chunks.push(expoTokens.slice(i, i + 100));

    for (const chunk of chunks) {
      const messages = chunk.map((to) => ({ to, title, body: message, data, sound: "default" }));
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.data) {
          console.error("match-notify: Expo push API returned", res.status, JSON.stringify(payload));
          continue;
        }
        payload.data.forEach((ticket: { status: string; message?: string; details?: { error?: string } }, i: number) => {
          const token = chunk[i];
          if (ticket.status === "ok") {
            sent += 1;
          } else {
            console.error("match-notify: delivery ticket failed", token, JSON.stringify(ticket));
            ticketErrors.push({ token, status: ticket.status, message: ticket.message, error: ticket.details?.error });
            if (ticket.details?.error === "DeviceNotRegistered") staleTokens.push(token);
          }
        });
      } catch (err) {
        console.error("match-notify: Expo push API request failed", err);
      }
    }
  }

  // Web subscriptions go through the Web Push protocol directly (VAPID-
  // signed, payload encrypted client-library-side) rather than Expo's API
  // — each push_tokens row for platform 'web' holds a JSON-stringified
  // PushSubscription from the browser's own Push API.
  if (webTokens.length > 0 && webPushReady) {
    const payload = JSON.stringify({ title, body: message, data });
    for (const token of webTokens) {
      try {
        const subscription = JSON.parse(token);
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (err: any) {
        const statusCode = err?.statusCode;
        console.error("match-notify: web push failed", statusCode, err?.body ?? err);
        ticketErrors.push({ token, status: "error", message: err?.body, error: String(statusCode ?? err) });
        if (statusCode === 404 || statusCode === 410) staleTokens.push(token);
      }
    }
  } else if (webTokens.length > 0 && !webPushReady) {
    console.error("match-notify: web push subscriptions exist but VAPID secrets aren't configured — skipping.");
  }

  if (staleTokens.length > 0) {
    await supabase.from("push_tokens").delete().in("token", staleTokens);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      recipients: profileIds.length,
      tokens: expoTokens.length + webTokens.length,
      sent,
      ticketErrors,
    }),
  );
});
