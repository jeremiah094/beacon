import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { placementPoints } from '../scoring';

export type GameResultRow = {
  teamId: string;
  teamName: string;
  placement: number | null;
  kills: number | null;
  placementPoints: number | null;
  totalPoints: number | null;
  isMyTeam: boolean;
};

export type GameResultsData = {
  gameId: string;
  leagueName: string;
  roundNumber: number;
  gameNumber: number;
  map: string | null;
  scheduledAt: string;
  published: boolean;
  rows: GameResultRow[];
};

async function fetchGameResults(gameId: string, myTeamId: string | undefined): Promise<GameResultsData> {
  const { data: game, error } = await supabase
    .from('games')
    .select('id, league_id, round_number, game_number, map, scheduled_at, leagues(name)')
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
    .select('team_id, placement, kills, published_at')
    .eq('game_id', gameId);
  const resultByTeam = new Map((results ?? []).map((r) => [r.team_id, r]));

  const published = (results ?? []).some((r) => !!r.published_at);

  const rows: GameResultRow[] = (approved ?? [])
    .filter((r) => r.teams)
    .map((r) => {
      const t = r.teams!;
      const res = resultByTeam.get(t.id);
      const hasResult = res?.placement != null && res?.kills != null && !!res?.published_at;
      const pPoints = hasResult ? placementPoints(res!.placement as number) : null;
      const total = hasResult ? (pPoints as number) + (res!.kills as number) : null;
      return {
        teamId: t.id,
        teamName: t.name,
        placement: hasResult ? (res!.placement as number) : null,
        kills: hasResult ? (res!.kills as number) : null,
        placementPoints: pPoints,
        totalPoints: total,
        isMyTeam: t.id === myTeamId,
      };
    })
    .sort((a, b) => {
      if (a.totalPoints == null && b.totalPoints == null) return a.teamName.localeCompare(b.teamName);
      if (a.totalPoints == null) return 1;
      if (b.totalPoints == null) return -1;
      return b.totalPoints - a.totalPoints;
    });

  return {
    gameId: game.id,
    leagueName: (game.leagues as any)?.name ?? 'League',
    roundNumber: game.round_number,
    gameNumber: game.game_number,
    map: game.map,
    scheduledAt: game.scheduled_at,
    published,
    rows,
  };
}

export function useGameResults(gameId: string | undefined, myTeamId: string | undefined) {
  return useQuery({
    queryKey: ['gameResults', gameId, myTeamId],
    queryFn: () => fetchGameResults(gameId as string, myTeamId),
    enabled: !!gameId,
  });
}
