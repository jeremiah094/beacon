import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type StandingsRow = {
  rank: number;
  teamId: string;
  name: string;
  kills: number;
  points: number;
  gamesPlayed: number;
  // head_to_head only (0 for battle_royale): series record and map
  // difference, the tiebreak after points.
  seriesWon: number;
  seriesLost: number;
  mapDiff: number;
  isMine: boolean;
};

export type StandingsData = {
  leagueName: string;
  seasonLabel: string | null;
  formatType: 'battle_royale' | 'head_to_head';
  completedGames: number;
  totalGames: number;
  registeredTeams: number;
  rows: StandingsRow[];
};

type MergedRow = {
  team_id: string;
  name: string;
  points: number;
  kills: number;
  played: number;
  won: number;
  lost: number;
  mapDiff: number;
  mapsWon: number;
};

export async function fetchStandings(leagueId: string, myTeamId?: string): Promise<StandingsData> {
  const { data: league } = await supabase
    .from('leagues')
    .select('name, season_label, titles(format_type)')
    .eq('id', leagueId)
    .single();
  const formatType = ((league?.titles as any)?.format_type as 'battle_royale' | 'head_to_head') ?? 'battle_royale';

  const { data: allTeams } = await supabase
    .from('league_teams')
    .select('team_id, teams(name)')
    .eq('league_id', leagueId)
    .eq('status', 'approved');

  let scored: MergedRow[];
  if (formatType === 'head_to_head') {
    const { data } = await supabase
      .from('h2h_standings')
      .select('team_id, series_played, series_won, series_lost, maps_won, maps_lost, total_points, teams(name)')
      .eq('league_id', leagueId);
    scored = (data ?? []).map((r) => ({
      team_id: r.team_id as string,
      name: (r.teams as any)?.name ?? 'Team',
      points: r.total_points ?? 0,
      kills: 0,
      played: r.series_played ?? 0,
      won: r.series_won ?? 0,
      lost: r.series_lost ?? 0,
      mapDiff: (r.maps_won ?? 0) - (r.maps_lost ?? 0),
      mapsWon: r.maps_won ?? 0,
    }));
  } else {
    const { data } = await supabase
      .from('standings')
      .select('team_id, total_kills, total_points, games_played, teams(name)')
      .eq('league_id', leagueId);
    scored = (data ?? []).map((r) => ({
      team_id: r.team_id as string,
      name: (r.teams as any)?.name ?? 'Team',
      points: r.total_points ?? 0,
      kills: r.total_kills ?? 0,
      played: r.games_played ?? 0,
      won: 0,
      lost: 0,
      mapDiff: 0,
      mapsWon: 0,
    }));
  }

  // Teams with zero results yet don't appear in either standings view —
  // merge in the rest at 0 pts so the count/order still reflects every
  // registered team.
  const seen = new Set(scored.map((r) => r.team_id));
  const zeroRows: MergedRow[] = (allTeams ?? [])
    .filter((t) => !seen.has(t.team_id))
    .map((t) => ({ team_id: t.team_id, name: (t.teams as any)?.name ?? 'Team', points: 0, kills: 0, played: 0, won: 0, lost: 0, mapDiff: 0, mapsWon: 0 }));

  // Tiebreaks only bite for head_to_head (both are 0 for battle_royale):
  // map difference, then maps won — same order as the /watch table.
  const merged = [...scored, ...zeroRows].sort((a, b) => b.points - a.points || b.mapDiff - a.mapDiff || b.mapsWon - a.mapsWon);

  // Progress bar: Apex counts games, head_to_head counts fixtures
  // (cancelled ones excluded — they'll never complete).
  const progressTable = formatType === 'head_to_head' ? 'fixtures' : 'games';
  let totalQuery = supabase.from(progressTable).select('id', { count: 'exact', head: true }).eq('league_id', leagueId);
  if (formatType === 'head_to_head') totalQuery = totalQuery.neq('status', 'cancelled');
  const [{ count: completedGames }, { count: totalGames }] = await Promise.all([
    supabase.from(progressTable).select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('status', 'completed'),
    totalQuery,
  ]);

  return {
    leagueName: league?.name ?? 'League',
    seasonLabel: league?.season_label ?? null,
    formatType,
    completedGames: completedGames ?? 0,
    totalGames: totalGames ?? 0,
    registeredTeams: merged.length,
    rows: merged.map((r, i) => ({
      rank: i + 1,
      teamId: r.team_id,
      name: r.name,
      kills: r.kills,
      points: r.points,
      gamesPlayed: r.played,
      seriesWon: r.won,
      seriesLost: r.lost,
      mapDiff: r.mapDiff,
      isMine: r.team_id === myTeamId,
    })),
  };
}

export function useStandings(leagueId: string | undefined, myTeamId?: string) {
  return useQuery({
    queryKey: ['standings', leagueId, myTeamId],
    queryFn: () => fetchStandings(leagueId as string, myTeamId),
    enabled: !!leagueId,
  });
}
