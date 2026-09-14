import { supabase } from '../supabase';

export type ApexPlatform = 'PC' | 'X1' | 'PS4';

export const PLATFORM_OPTIONS: { value: ApexPlatform; label: string }[] = [
  { value: 'PC', label: 'PC' },
  { value: 'PS4', label: 'PlayStation' },
  { value: 'X1', label: 'Xbox' },
];

export type ApexLinkFailureReason = 'not_found' | 'platform_mismatch' | 'rate_limited' | 'upstream_down';

export type ApexLinkStats = {
  apexUid: string;
  platform: ApexPlatform;
  rankName: string | null;
  rankScore: number | null;
  kd: number | null;
  wins: number | null;
  mostPlayedLegend: string | null;
  level: number | null;
  fetchedAt: string;
};

export type ApexLinkResult =
  | { ok: true; stats: ApexLinkStats }
  | { ok: false; reason: ApexLinkFailureReason; message: string };

/** Calls the apex-link-id Edge Function (BUILD.md §4). Requires an active session. */
export async function linkApexId(player: string, platform: ApexPlatform = 'PC'): Promise<ApexLinkResult> {
  const { data, error } = await supabase.functions.invoke<ApexLinkResult>('apex-link-id', {
    body: { player, platform },
  });
  if (error || !data) {
    return { ok: false, reason: 'upstream_down', message: "Apex's stat service is temporarily unavailable. Try again shortly." };
  }
  return data;
}
