// valorant-link-id — Valorant pilot, identity verification only. Riot's
// OFFICIAL API has no "get this player's current rank" endpoint — val-ranked-v1
// only exposes a competitive-queue leaderboard lookup (confirmed against the
// real method list Riot issued for this app's key: account-v1, val-content-v1,
// val-ranked-v1 leaderboard, val-status-v1 — nothing else Valorant-specific).
// So unlike apex-link-id, this only confirms the Riot ID resolves to a real
// PUUID via account-v1 and stores that — rank_name/kd/wins etc. stay null in
// game_accounts for Valorant until Riot exposes (or we get access to) a
// per-player stats source.
//
// RIOT_API_KEY is a Supabase Edge Function secret — set separately
// (dashboard or `supabase secrets set`), never present in this source or the
// client bundle. account-v1 is continent-routed (americas/asia/europe), not
// platform-routed, and returns the same global account data from any of the
// three hosts — 'europe' is used unconditionally rather than asking the
// player to pick one.
import { createClient } from "jsr:@supabase/supabase-js@2";

type LinkRequest = {
  riotId: string; // "GameName#TagLine"
};

type LinkFailureReason = "not_found" | "invalid_format" | "rate_limited" | "upstream_down";

const FAILURE_COPY: Record<LinkFailureReason, string> = {
  not_found: "No Riot account matches that Riot ID. Double-check the name and tag and try again.",
  invalid_format: "Enter your Riot ID as Name#Tag — e.g. Player#EUW1.",
  rate_limited: "Riot's servers are busy right now. Wait a moment and try again.",
  upstream_down: "Riot's account service is temporarily unavailable. Try again shortly.",
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
  const RIOT_API_KEY = Deno.env.get("RIOT_API_KEY");

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

  const riotId = body.riotId?.trim();
  const hashIndex = riotId ? riotId.indexOf("#") : -1;
  if (!riotId || hashIndex <= 0 || hashIndex === riotId.length - 1) {
    return jsonResponse({ ok: false, reason: "invalid_format", message: FAILURE_COPY.invalid_format }, 200);
  }
  const gameName = riotId.slice(0, hashIndex);
  const tagLine = riotId.slice(hashIndex + 1);

  if (!RIOT_API_KEY) {
    console.error("valorant-link-id: RIOT_API_KEY secret is not set");
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  const upstreamUrl = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, { headers: { "X-Riot-Token": RIOT_API_KEY } });
  } catch (err) {
    console.error("valorant-link-id: upstream fetch failed", err);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  if (upstreamRes.status === 429) {
    return jsonResponse({ ok: false, reason: "rate_limited", message: FAILURE_COPY.rate_limited }, 200);
  }
  if (upstreamRes.status === 404) {
    return jsonResponse({ ok: false, reason: "not_found", message: FAILURE_COPY.not_found }, 200);
  }
  if (!upstreamRes.ok) {
    console.error("valorant-link-id: upstream returned", upstreamRes.status);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  const raw = await upstreamRes.json();
  const puuid: string | undefined = raw?.puuid;
  if (!puuid) {
    return jsonResponse({ ok: false, reason: "not_found", message: FAILURE_COPY.not_found }, 200);
  }

  const resolvedGameName: string = raw?.gameName ?? gameName;
  const resolvedTagLine: string = raw?.tagLine ?? tagLine;
  const resolvedRiotId = `${resolvedGameName}#${resolvedTagLine}`;
  const fetchedAt = new Date().toISOString();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Don't clobber an existing gamertag (e.g. already set by linking a
  // different title) — only fill it in if the player has none yet.
  const { data: existingProfile } = await admin.from("profiles").select("gamertag").eq("id", user.id).maybeSingle();
  if (!existingProfile?.gamertag) {
    await admin.from("profiles").update({ gamertag: resolvedRiotId }).eq("id", user.id);
  }

  const { data: valorantTitle, error: titleError } = await admin.from("titles").select("id").eq("slug", "valorant").single();
  if (titleError || !valorantTitle) {
    console.error("valorant-link-id: failed to resolve valorant title", titleError);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  const { error: accountError } = await admin.from("game_accounts").upsert(
    {
      profile_id: user.id,
      title_id: valorantTitle.id,
      external_uid: puuid,
      platform: null,
      verified_at: fetchedAt,
      rank_name: null,
      rank_score: null,
      kd: null,
      wins: null,
      kills: null,
      most_played_legend: null,
      level: null,
      raw: { gameName: resolvedGameName, tagLine: resolvedTagLine, puuid },
      fetched_at: fetchedAt,
    },
    { onConflict: "profile_id,title_id" },
  );
  if (accountError) {
    console.error("valorant-link-id: failed to upsert game_accounts", accountError);
    return jsonResponse({ ok: false, reason: "upstream_down", message: FAILURE_COPY.upstream_down }, 200);
  }

  return jsonResponse({
    ok: true,
    stats: { riotId: resolvedRiotId, puuid, fetchedAt },
  });
});
