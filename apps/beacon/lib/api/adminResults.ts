import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export { placementPoints } from '../scoring';

export type ResultRow = {
  teamId: string;
  teamName: string;
  placement: number | null;
  kills: number | null;
  source: 'api' | 'manual' | null;
  publishedAt: string | null;
};

export type SubLogEntry = {
  id: string;
  teamName: string;
  outName: string;
  inName: string;
  appliedByName: string;
  appliedAt: string;
  reason: string | null;
};

export type ResultsGame = {
  id: string;
  leagueId: string;
  leagueName: string;
  roundNumber: number;
  gameNumber: number;
  map: string | null;
  status: string;
  scheduledAt: string;
  rows: ResultRow[];
  subLog: SubLogEntry[];
  locked: boolean;
};

function displayName(p: { display_name: string | null; gamertag: string | null } | null | undefined): string {
  return p?.display_name || p?.gamertag || 'Player';
}

async function fetchResults(gameId: string): Promise<ResultsGame> {
  const { data: game, error } = await supabase
    .from('games')
    .select('id, league_id, round_number, game_number, map, status, scheduled_at, leagues(name)')
    .eq('id', gameId)
    .single();
  if (error || !game) throw error ?? new Error('Game not found');

  const { data: approved } = await supabase
    .from('league_teams')
    .select('team_id, teams(id, name)')
    .eq('league_id', game.league_id)
    .eq('status', 'approved');

  const { data: results } = await supabase
    .from('results')
    .select('team_id, placement, kills, source, published_at')
    .eq('game_id', gameId);
  const resultByTeam = new Map((results ?? []).map((r) => [r.team_id, r]));

  const rows: ResultRow[] = (approved ?? [])
    .filter((r) => r.teams)
    .map((r) => {
      const t = r.teams!;
      const res = resultByTeam.get(t.id);
      return {
        teamId: t.id,
        teamName: t.name,
        placement: res?.placement ?? null,
        kills: res?.kills ?? null,
        source: (res?.source as ResultRow['source']) ?? null,
        publishedAt: res?.published_at ?? null,
      };
    })
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  const { data: subs } = await supabase
    .from('substitutions')
    .select(
      'id, team_id, reason, applied_at, teams(name), out:profiles!substitutions_out_profile_id_fkey(display_name, gamertag), in:profiles!substitutions_in_profile_id_fkey(display_name, gamertag), applied:profiles!substitutions_applied_by_fkey(display_name, gamertag)',
    )
    .eq('game_id', gameId)
    .order('applied_at', { ascending: true });

  const subLog: SubLogEntry[] = (subs ?? []).map((s) => ({
    id: s.id,
    teamName: (s.teams as any)?.name ?? 'Team',
    outName: displayName(s.out as any),
    inName: displayName(s.in as any),
    appliedByName: displayName(s.applied as any),
    appliedAt: s.applied_at,
    reason: s.reason,
  }));

  const locked = rows.some((r) => !!r.publishedAt);

  return {
    id: game.id,
    leagueId: game.league_id,
    leagueName: (game.leagues as any)?.name ?? 'League',
    roundNumber: game.round_number,
    gameNumber: game.game_number,
    map: game.map,
    status: game.status,
    scheduledAt: game.scheduled_at,
    rows,
    subLog,
    locked,
  };
}

export function useResultsGame(gameId: string | undefined) {
  return useQuery({
    queryKey: ['adminResults', gameId],
    queryFn: () => fetchResults(gameId as string),
    enabled: !!gameId,
  });
}

export function usePublishResults(gameId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entries, adminId }: { entries: { teamId: string; placement: number; kills: number }[]; adminId: string }) => {
      const now = new Date().toISOString();
      const { error } = await supabase.from('results').upsert(
        entries.map((e) => ({
          game_id: gameId as string,
          team_id: e.teamId,
          placement: e.placement,
          kills: e.kills,
          source: 'manual' as const,
          entered_by: adminId,
          published_at: now,
        })),
        { onConflict: 'game_id,team_id' },
      );
      if (error) throw error;

      await supabase.from('games').update({ status: 'completed' }).eq('id', gameId as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminResults', gameId] });
      queryClient.invalidateQueries({ queryKey: ['adminGames'] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useReopenResults(gameId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('results').update({ published_at: null }).eq('game_id', gameId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminResults', gameId] });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

/** Removes one team's result row entirely (not just unpublishing it) —
 * for a row entered against the wrong team, or a team that never actually
 * played. RLS's `results_write` is `for all using (is_admin())`, which
 * already covers DELETE. */
export function useDeleteResult(gameId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('results').delete().eq('game_id', gameId as string).eq('team_id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminResults', gameId] });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}
