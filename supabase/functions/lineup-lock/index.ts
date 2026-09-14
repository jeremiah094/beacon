// lineup-lock — BUILD.md §5. The actual every-minute automation is a
// direct pg_cron -> SQL function (lock_overdue_lineups(), see migration
// 20260914125000_lineup_lock_cron.sql) rather than cron calling this HTTP
// endpoint: it's atomic, needs no secret to invoke, and has no network
// hop. This function is a thin wrapper around the same SQL function, kept
// for manual triggering and Edge Function log visibility, matching the
// project layout in BUILD.md §1.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase.rpc("lock_overdue_lineups");
  if (error) {
    console.error("lineup-lock: lock_overdue_lineups failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
