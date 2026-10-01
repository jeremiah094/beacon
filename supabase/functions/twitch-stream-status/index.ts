// twitch-stream-status — called only by pg_net from poll_observer_streams()
// (20260930_observer_twitch_streaming.sql), never by a client directly —
// mirrors match-notify's trigger-only invocation pattern (verify_jwt:
// false, same reasoning). Batches every live-ish game/fixture whose
// observer has a Twitch login set into one Get Streams call, then writes
// the live/offline result back with the service-role client. No client
// ever calls Twitch or holds a token.
//
// Games (not fixtures — Valorant has no player-facing fixture screen to
// deep-link into yet, same gap already flagged elsewhere) also get a push
// via match-notify the moment a stream transitions offline→live. This is
// edge-triggered deliberately: the cron polls every minute, so notifying
// on every "still live" tick would mean a push a minute for the whole
// broadcast. The prior observer_stream_live value is read before the
// write so that transition can be detected.
import { createClient } from "jsr:@supabase/supabase-js@2";

type Entry = { table: "games" | "fixtures"; id: string; twitchLogin: string };
type Body = { entries: Entry[] };

const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Module-scoped cache — reused across invocations on a warm isolate; a
// cold start just refetches. Twitch app tokens last ~60 days, so this
// mostly saves a round-trip rather than avoiding rate limits.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    console.error("twitch-stream-status: token request failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const payload = await res.json();
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in - 60) * 1000 };
  return cachedToken.value;
}

Deno.serve(async (req: Request) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const entries = (body.entries ?? []).filter((e) => e.twitchLogin);
  if (entries.length === 0) return new Response(JSON.stringify({ ok: true, checked: 0 }));

  const token = await getAppToken();
  if (!token) {
    console.error("twitch-stream-status: TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET not configured — skipping.");
    return new Response(JSON.stringify({ ok: true, checked: 0, skipped: "not_configured" }));
  }

  // Get Streams takes up to 100 user_login params per call.
  const logins = [...new Set(entries.map((e) => e.twitchLogin.toLowerCase()))].slice(0, 100);
  const params = new URLSearchParams();
  for (const login of logins) params.append("user_login", login);

  const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
    headers: { "Client-Id": TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
  });
  if (!streamsRes.ok) {
    console.error("twitch-stream-status: Get Streams failed", streamsRes.status, await streamsRes.text().catch(() => ""));
    return new Response(JSON.stringify({ ok: false, error: "twitch_api_error" }), { status: 502 });
  }
  const streamsPayload = await streamsRes.json();
  const liveByLogin = new Map<string, { title: string; viewer_count: number }>();
  for (const s of streamsPayload.data ?? []) {
    liveByLogin.set(String(s.user_login).toLowerCase(), { title: s.title, viewer_count: s.viewer_count });
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const checkedAt = new Date().toISOString();

  const gameIds = entries.filter((e) => e.table === "games").map((e) => e.id);
  const priorLiveByGameId = new Map<string, boolean>();
  if (gameIds.length > 0) {
    const { data: priorRows } = await supabase.from("games").select("id, observer_stream_live").in("id", gameIds);
    for (const r of priorRows ?? []) priorLiveByGameId.set(r.id, r.observer_stream_live);
  }

  const results = await Promise.all(
    entries.map(async (e) => {
      const live = liveByLogin.get(e.twitchLogin.toLowerCase());
      const nowLive = !!live;
      const { error } = await supabase
        .from(e.table)
        .update({
          observer_stream_live: nowLive,
          observer_stream_title: live?.title ?? null,
          observer_stream_viewers: live?.viewer_count ?? null,
          observer_stream_checked_at: checkedAt,
        })
        .eq("id", e.id);
      if (error) {
        console.error(`twitch-stream-status: failed to update ${e.table}.${e.id}`, error);
        return false;
      }

      if (e.table === "games" && nowLive && !priorLiveByGameId.get(e.id)) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/match-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "stream_live", gameId: e.id }),
          });
        } catch (err) {
          console.error(`twitch-stream-status: stream_live notify failed for games.${e.id}`, err);
        }
      }

      return true;
    }),
  );

  return new Response(JSON.stringify({ ok: true, checked: entries.length, updated: results.filter(Boolean).length }));
});
