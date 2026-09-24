// delete-account — player-initiated account deletion (profile screen).
// The client re-verifies the caller's password via signInWithPassword
// before calling this function (UX confirmation only — see
// PasswordConfirmPanel). The real authorization boundary is here: this
// function derives the account to delete from the caller's own JWT via
// auth.getUser(), never from the request body, so a caller can only ever
// delete their own account.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    return jsonResponse({ ok: false, message: "Missing Authorization header." }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();

  if (!user) {
    return jsonResponse({ ok: false, message: "Not signed in." }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Status 200 on handled failures (not 4xx/5xx) — supabase-js's
  // functions.invoke() only hands the response body back through `data`
  // for a 2xx status; a non-2xx short-circuits to a generic FunctionsError
  // and the body (including this message) is lost. Same convention as
  // apex-link-id's handled failure paths.
  const { error: cleanupError } = await admin.rpc("delete_account_cleanup", { p_profile_id: user.id });
  if (cleanupError) {
    console.error("delete-account: delete_account_cleanup failed", cleanupError);
    return jsonResponse(
      { ok: false, message: cleanupError.message || "Couldn't delete your account. Try again." },
      200,
    );
  }

  // Hard delete (default) so the FK cascade from auth.users -> profiles ->
  // everything else actually runs. Soft-deleting would leave the row (and
  // the cascade) in place.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    console.error("delete-account: auth.admin.deleteUser failed", deleteError);
    return jsonResponse({ ok: false, message: "Couldn't delete your account. Try again." }, 200);
  }

  return jsonResponse({ ok: true });
});
