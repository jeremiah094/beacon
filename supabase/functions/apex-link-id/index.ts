// apex-link-id — BUILD.md §4. Called from screen 01 (Sign Up). Verifies a
// player/platform pair against apexlegendsapi.com (fronted by
// api.mozambiquehe.re) and, on success, writes apex_uid/apex_platform/
// apex_verified_at to the caller's profile and seeds player_stats.
//
// APEX_API_KEY is a Supabase Edge Function secret — set separately
// (dashboard or `supabase secrets set`), never present in this source or
// the client bundle.
//
// Field-mapping note: apexlegendsapi.com's "bridge" endpoint doesn't expose
// a network-documented schema we could verify from this environment (the
// egress proxy blocks apexlegendsapi.com and its docs host). The shapes
// below (`global.rank`, `global.level`, `legends.selected`) come from the
// community Python/Go wrappers' field usage; `raw` is always stored
// alongside the parsed fields so a bad guess is correctable without
// re-calling the API.
//
// `raw.total` is the player's self-chosen in-game "Stat Trackers" (they
// pin 2-3 of Kills/Wins/KD/Damage/Revives/etc.), so there's no fixed key
// per account — every entry is matched by its human-readable `name` field
// instead (see findTrackerValue below). A value of -1 is Respawn's "not
// computed yet" sentinel and is treated as unavailable, never rendered as
// a fabricated 0.
import { createClient } from "jsr:@supabase/supabase-js@2";

type Platform = "PC" | "X1" | "PS4";

type LinkRequest = {
  player: string;
  platform?: Platform;
};

type LinkFailureReason = "not_found" | "platform_mismatch" | "rate_limited" | "upstream_down";

const FAILURE_COPY: Record<LinkFailureReason, string> = {
  not_found:
    "No Apex account matches that ID. Check the spelling in-game under Profile, or try linking with your EA Play ID instead.",
  platform_mismatch:
    "That ID exists, but not on the platform we checked. Confirm you're on the right platform and try again.",
  rate_limited: "Apex's servers are busy right now. Wait a moment and try again.",
  upstream_down: "Apex's stat service is temporarily unavailable. Try again shortly.",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function findTrackerValue(total: Record<string, unknown> | undefined, namePattern: RegExp): number | null {
  if (!total || typeof total !== "object") return null;
  for (const entry of Object.values(total)) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as any).name === "string" &&
      namePattern.test((entry as any).name)
    ) {
      const rawValue = (entry as any).value;
      const v = typeof rawValue === "string" ? Number(rawValue) : rawValue;
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ ok: false, reason: "not_found", message: "Missing Authorization header." }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const APEX_API_KEY = Deno.env.get("APEX_API_KEY");

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();

  if (!user) {
    return jsonResponse({ ok: false, reason: "not_found", message: "Not signed in." }, 401);
  }

  let body: LinkRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "not_found", message: "Malformed request body." }, 400);
  }

  const player = body.player?.trim();
  const platform: Platform = body.platform ?? "PC";
  if (!player) {
    return jsonResponse({ ok: false, reason: "not_found", message: "No player ID given." }, 400);
  }

  if (!APEX_API_KEY) {
    console.error("apex-link-id: APEX_API_KEY secret is not set");
    return jsonResponse(
      { ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down },
      200,
    );
  }

  const upstreamUrl = new URL("https://api.mozambiquehe.re/bridge");
  upstreamUrl.searchParams.set("version", "5");
  upstreamUrl.searchParams.set("platform", platform);
  upstreamUrl.searchParams.set("player", player);
  upstreamUrl.searchParams.set("auth", APEX_API_KEY);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl.toString());
  } catch (err) {
    console.error("apex-link-id: upstream fetch failed", err);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  if (upstreamRes.status === 429) {
    return jsonResponse({ ok: false, reason: "rate_limited", message: FAILURE_COPY.rate_limited }, 200);
  }
  if (upstreamRes.status === 404) {
    return jsonResponse({ ok: false, reason: "not_found", message: FAILURE_COPY.not_found }, 200);
  }
  if (!upstreamRes.ok) {
    console.error("apex-link-id: upstream returned", upstreamRes.status);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  const raw = await upstreamRes.json();

  if (raw?.Error || raw?.error) {
    const message: string = String(raw.Error ?? raw.error);
    const reason: LinkFailureReason = /not\s*found/i.test(message) ? "not_found" : "upstream_down";
    return jsonResponse({ ok: false, reason, message: FAILURE_COPY[reason] }, 200);
  }

  const global = raw?.global ?? {};
  const uid: string | undefined = global.uid != null ? String(global.uid) : undefined;
  if (!uid) {
    return jsonResponse({ ok: false, reason: "not_found", message: FAILURE_COPY.not_found }, 200);
  }

  const gamertag: string = typeof global.name === "string" && global.name.length > 0 ? global.name : player;
  const rankName: string | null = global.rank?.rankName ?? null;
  const rankScore: number | null = typeof global.rank?.rankScore === "number" ? global.rank.rankScore : null;
  const level: number | null = typeof global.level === "number" ? global.level : null;
  const mostPlayedLegend: string | null =
    raw?.legends?.selected?.LegendName ?? raw?.legends?.selected?.legendName ?? null;
  const wins: number | null = findTrackerValue(raw?.total, /wins?/i);
  const kd: number | null = findTrackerValue(raw?.total, /k\/?d/i);
  const kills: number | null = findTrackerValue(raw?.total, /kills?/i);

  const fetchedAt = new Date().toISOString();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ gamertag, apex_uid: uid, apex_platform: platform, apex_verified_at: fetchedAt })
    .eq("id", user.id);
  if (profileError) {
    console.error("apex-link-id: failed to update profile", profileError);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  const { error: statsError } = await admin.from("player_stats").upsert({
    profile_id: user.id,
    rank_name: rankName,
    rank_score: rankScore,
    kd,
    wins,
    kills,
    most_played_legend: mostPlayedLegend,
    level,
    raw,
    fetched_at: fetchedAt,
  });
  if (statsError) {
    console.error("apex-link-id: failed to upsert player_stats", statsError);
  }

  return jsonResponse({
    ok: true,
    stats: {
      apexUid: uid,
      platform,
      rankName,
      rankScore,
      kd,
      wins,
      kills,
      mostPlayedLegend,
      level,
      fetchedAt,
    },
  });
});
