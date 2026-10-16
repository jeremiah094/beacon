// match-notify — BUILD.md §5. Triggers call this (see
// 20260914131000_match_notify_triggers.sql via pg_net, fire-and-forget, and
// twitch-stream-status via a plain fetch on the same fire-and-forget basis):
//  - "new_match": games AFTER INSERT, when the league is published.
//  - "lock_soon": the same cron tick that locks a game's lineups at T-10m
//    (BUILD.md: "this notification also represents the moment team
//    lineups lock for that game" — one moment, one push).
//  - "stream_live": twitch-stream-status, the moment a game's observer
//    transitions from offline to live (edge-triggered, never per poll tick
//    — the cron runs every minute and would otherwise spam the same push).
// Recipients are every member of every team approved for the league;
// lock_soon and stream_live additionally exclude anyone who muted that
// specific game (screen 07's per-game bell — notification_prefs).
//
// Head-to-head fixtures (Valorant/CS2/Rocket League —
// 20261016110257_fixture_notifications.sql) use the same three moments,
// keyed by fixtureId(s) instead of gameId, with two differences:
//  - Recipients are only the two teams in the fixture, not the whole
//    league — a 1v1 series doesn't concern the other six teams.
//  - "new_match" arrives as one call per insert statement with every new
//    fixture's id, since generating a round robin inserts the whole
//    season at once: each player gets one "your fixtures are out" message
//    rather than one push per fixture.
// Fixture notifications only go out for published leagues (draft leagues'
// fixtures are still being set up), and there's no per-fixture mute yet —
// notification_prefs is keyed to games.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type NotifyBody =
  | { type: "new_match" | "lock_soon" | "stream_live"; gameId: string }
  | { type: "new_match"; fixtureIds: string[] }
  | { type: "lock_soon" | "stream_live"; fixtureId: string };

type Delivery = { profileId: string; title: string; message: string; url: string };

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const webPushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (webPushReady) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

// Edge Functions run in UTC — pin the zone so "20:00" means 20:00 in
// Ireland, where every league is played.
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IE", {
    timeZone: "Europe/Dublin",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

Deno.serve(async (req: Request) => {
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const result = "gameId" in body ? await gameDeliveries(supabase, body) : await fixtureDeliveries(supabase, body);
  if ("error" in result) {
    return new Response(JSON.stringify({ ok: false, error: result.error }), { status: 404 });
  }
  return new Response(JSON.stringify({ ok: true, ...(await deliver(supabase, result.deliveries)) }));
});

async function gameDeliveries(
  supabase: SupabaseClient,
  body: { type: "new_match" | "lock_soon" | "stream_live"; gameId: string },
): Promise<{ deliveries: Delivery[] } | { error: string }> {
  const { data: game } = await supabase
    .from("games")
    .select(
      "id, round_number, game_number, scheduled_at, map, lobby_code, league_id, leagues(name), observer:profiles!games_observer_id_fkey(twitch_login)",
    )
    .eq("id", body.gameId)
    .single();

  if (!game) return { error: "game not found" };

  const leagueName = (game.leagues as any)?.name ?? "your league";
  const when = formatWhen(game.scheduled_at);

  const { data: approvedTeams } = await supabase
    .from("league_teams")
    .select("team_id")
    .eq("league_id", game.league_id)
    .eq("status", "approved");
  const teamIds = (approvedTeams ?? []).map((t) => t.team_id);
  if (teamIds.length === 0) return { deliveries: [] };

  const { data: members } = await supabase.from("team_members").select("profile_id").in("team_id", teamIds);
  let profileIds = [...new Set((members ?? []).map((m) => m.profile_id as string))];

  if (body.type === "lock_soon" || body.type === "stream_live") {
    const { data: muted } = await supabase
      .from("notification_prefs")
      .select("profile_id")
      .eq("game_id", game.id)
      .eq("muted", true);
    const mutedSet = new Set((muted ?? []).map((m) => m.profile_id));
    profileIds = profileIds.filter((id) => !mutedSet.has(id));
  }

  const matchLabel = `Match ${game.round_number} · Game ${game.game_number}`;

  // new_match/lock_soon are plain in-app paths, not a beacon:// scheme —
  // native's deep-link handler (useNotificationDeepLinks) already strips a
  // beacon:// prefix if one is there, so a bare path passes through
  // unchanged, and the web service worker's notificationclick handler uses
  // the same path directly. stream_live is the one exception: a real
  // https:// URL, which both handlers open externally instead of routing
  // in-app (see the stream_live case below).
  const { title, message, url } =
    body.type === "new_match"
      ? {
          title: "New game scheduled",
          message: `${leagueName} added ${matchLabel} — ${when}${game.map ? `, ${game.map}` : ""}. 20-team lobby.`,
          url: `/games`,
        }
      : body.type === "lock_soon"
        ? {
            title: "Lobby opens in 10 minutes",
            message: `${matchLabel} · ${leagueName}. Lineups are locked as of now. Tap to open your lobby code.`,
            url: `/games/${game.id}/lobby`,
          }
        : {
            title: "Observer is live on Twitch",
            message: `${matchLabel} · ${leagueName} is streaming now${game.map ? ` on ${game.map}` : ""}. Tap to watch.`,
            // A real https:// URL here, not an in-app path — the native
            // deep-link handler (useNotificationDeepLinks) opens it
            // directly via Linking.openURL rather than routing in-app, so
            // tapping this notification goes straight to the stream. Falls
            // back to the lobby screen only if the observer's Twitch login
            // somehow isn't set (shouldn't happen — we only notify once
            // Get Streams has already confirmed them live under that login).
            url: (game.observer as any)?.twitch_login
              ? `https://twitch.tv/${(game.observer as any).twitch_login}`
              : `/games/${game.id}/lobby`,
          };

  return { deliveries: profileIds.map((profileId) => ({ profileId, title, message, url })) };
}

async function fixtureDeliveries(
  supabase: SupabaseClient,
  body: { type: "new_match"; fixtureIds: string[] } | { type: "lock_soon" | "stream_live"; fixtureId: string },
): Promise<{ deliveries: Delivery[] } | { error: string }> {
  const ids = "fixtureIds" in body ? body.fixtureIds : [body.fixtureId];
  if (ids.length === 0) return { deliveries: [] };

  const { data: rows } = await supabase
    .from("fixtures")
    .select(
      "id, round_number, scheduled_at, best_of, status, home_team_id, away_team_id, leagues(name, status), home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), observer:profiles!fixtures_observer_id_fkey(twitch_login)",
    )
    .in("id", ids)
    .neq("status", "cancelled")
    .order("scheduled_at");
  if (!rows || rows.length === 0) return { error: "fixture not found" };

  const fixtures = rows.filter((f) => (f.leagues as any)?.status === "published");
  if (fixtures.length === 0) return { deliveries: [] };

  const teamIds = [...new Set(fixtures.flatMap((f) => [f.home_team_id as string, f.away_team_id as string]))];
  const { data: members } = await supabase.from("team_members").select("team_id, profile_id").in("team_id", teamIds);
  const profilesByTeam = new Map<string, string[]>();
  for (const m of members ?? []) {
    profilesByTeam.set(m.team_id, [...(profilesByTeam.get(m.team_id) ?? []), m.profile_id]);
  }

  // Every fixture each player is in, with the side they're on — the
  // message names their own team and opponent rather than "home v away".
  type Entry = { fixture: (typeof fixtures)[number]; mine: string; opponent: string };
  const byProfile = new Map<string, Entry[]>();
  for (const f of fixtures) {
    const home = (f.home_team as any)?.name ?? "Home";
    const away = (f.away_team as any)?.name ?? "Away";
    const sides: [string, string, string][] = [
      [f.home_team_id, home, away],
      [f.away_team_id, away, home],
    ];
    for (const [teamId, mine, opponent] of sides) {
      for (const profileId of profilesByTeam.get(teamId) ?? []) {
        byProfile.set(profileId, [...(byProfile.get(profileId) ?? []), { fixture: f, mine, opponent }]);
      }
    }
  }

  const deliveries: Delivery[] = [];
  for (const [profileId, entries] of byProfile) {
    const first = entries[0];
    const f = first.fixture;
    const leagueName = (f.leagues as any)?.name ?? "your league";
    const label = `Round ${f.round_number} · ${first.mine} vs ${first.opponent}`;

    if (body.type === "new_match") {
      deliveries.push(
        entries.length === 1
          ? {
              profileId,
              title: "New match scheduled",
              message: `${leagueName} — ${label}, ${formatWhen(f.scheduled_at)}. Best of ${f.best_of}.`,
              url: `/fixtures`,
            }
          : {
              profileId,
              title: `Your ${leagueName} fixtures are out`,
              message: `${entries.length} matches scheduled for ${first.mine}. First up: ${first.opponent}, ${formatWhen(f.scheduled_at)}.`,
              url: `/fixtures`,
            },
      );
    } else if (body.type === "lock_soon") {
      deliveries.push({
        profileId,
        title: "Match starts in 10 minutes",
        message: `${label} · ${leagueName}. Lineups are locked as of now. Tap to open the match lobby.`,
        url: `/fixtures/${f.id}/lobby`,
      });
    } else {
      const twitch = (f.observer as any)?.twitch_login;
      deliveries.push({
        profileId,
        title: "Observer is live on Twitch",
        message: `${label} · ${leagueName} is streaming now. Tap to watch.`,
        url: twitch ? `https://twitch.tv/${twitch}` : `/fixtures/${f.id}/lobby`,
      });
    }
  }
  return { deliveries };
}

async function deliver(supabase: SupabaseClient, deliveries: Delivery[]) {
  if (deliveries.length === 0) return { recipients: 0 };

  // In-app inbox row for every recipient, independent of whether they have
  // any push token at all — the reliable fallback for players who never
  // granted OS notification permission (or later revoked it).
  const { error: notifyInsertError } = await supabase
    .from("notifications")
    .insert(deliveries.map((d) => ({ profile_id: d.profileId, title: d.title, body: d.message, url: d.url })));
  if (notifyInsertError) {
    console.error("match-notify: failed to insert in-app notifications", notifyInsertError);
  }

  const { data: tokenRows } = await supabase
    .from("push_tokens")
    .select("profile_id, token, platform")
    .in("profile_id", deliveries.map((d) => d.profileId));

  // One message per (token, delivery) — a token is only ever registered to
  // one profile, and each profile has exactly one delivery, so a token
  // can't receive the same push twice.
  const byProfile = new Map(deliveries.map((d) => [d.profileId, d]));
  const expoMessages: { token: string; d: Delivery }[] = [];
  const webMessages: { token: string; d: Delivery }[] = [];
  const seenTokens = new Set<string>();
  for (const t of tokenRows ?? []) {
    const d = byProfile.get(t.profile_id);
    if (!d || seenTokens.has(t.token)) continue;
    seenTokens.add(t.token);
    (t.platform === "web" ? webMessages : expoMessages).push({ token: t.token, d });
  }

  let sent = 0;
  const staleTokens: string[] = [];
  const ticketErrors: { token: string; status: string; message?: string; error?: string }[] = [];

  // Expo Push API accepts up to 100 messages per request. Its response has
  // one "ticket" per message — the outer HTTP call can be 200 OK while an
  // individual ticket still reports a real delivery failure (a stale
  // token, misconfigured credentials, etc.), so those tickets are what
  // actually tells us whether anything reached a device.
  for (let i = 0; i < expoMessages.length; i += 100) {
    const chunk = expoMessages.slice(i, i + 100);
    const messages = chunk.map(({ token, d }) => ({ to: token, title: d.title, body: d.message, data: { url: d.url }, sound: "default" }));
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
      payload.data.forEach((ticket: { status: string; message?: string; details?: { error?: string } }, j: number) => {
        const token = chunk[j].token;
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

  // Web subscriptions go through the Web Push protocol directly (VAPID-
  // signed, payload encrypted client-library-side) rather than Expo's API
  // — each push_tokens row for platform 'web' holds a JSON-stringified
  // PushSubscription from the browser's own Push API.
  if (webMessages.length > 0 && webPushReady) {
    for (const { token, d } of webMessages) {
      try {
        const subscription = JSON.parse(token);
        await webpush.sendNotification(subscription, JSON.stringify({ title: d.title, body: d.message, data: { url: d.url } }));
        sent += 1;
      } catch (err: any) {
        const statusCode = err?.statusCode;
        console.error("match-notify: web push failed", statusCode, err?.body ?? err);
        ticketErrors.push({ token, status: "error", message: err?.body, error: String(statusCode ?? err) });
        if (statusCode === 404 || statusCode === 410) staleTokens.push(token);
      }
    }
  } else if (webMessages.length > 0 && !webPushReady) {
    console.error("match-notify: web push subscriptions exist but VAPID secrets aren't configured — skipping.");
  }

  if (staleTokens.length > 0) {
    await supabase.from("push_tokens").delete().in("token", staleTokens);
  }

  return { recipients: deliveries.length, tokens: expoMessages.length + webMessages.length, sent, ticketErrors };
}
