import { supabase } from '../supabase';

export type ValorantLinkStats = {
  riotId: string;
  puuid: string;
  fetchedAt: string;
};

export type ValorantLinkFailureReason = 'not_found' | 'invalid_format' | 'rate_limited' | 'upstream_down';

export type ValorantLinkResult =
  | { ok: true; stats: ValorantLinkStats }
  | { ok: false; reason: ValorantLinkFailureReason; message: string };

/** Calls the valorant-link-id Edge Function. Requires an active session.
 * Identity verification only — see the function's own comment for why. */
export async function linkValorantId(riotId: string): Promise<ValorantLinkResult> {
  const { data, error } = await supabase.functions.invoke<ValorantLinkResult>('valorant-link-id', {
    body: { riotId },
  });
  if (error || !data) {
    return { ok: false, reason: 'upstream_down', message: "Riot's account service is temporarily unavailable. Try again shortly." };
  }
  return data;
}
