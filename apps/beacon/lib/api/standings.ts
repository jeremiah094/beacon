import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type StandingsRow = {
  rank: number;
  teamId: string;
  name: string;
  kills: number;
  points: number;
  gamesPlayed: number;
  isMine: boolean;
};

export type StandingsData = {
  leagueName: string;
  seasonLabel: string | null;
  completedGames: number;
  totalGames: number;
  registeredTeams: number;
  rows: StandingsRow[];
};

export async function fetchStandings(leagueId: string, myTeamId?: string): Promise<StandingsData> {
  const { data: league } = await supabase.from('leagues').select('name, season_label').eq('id', leagueId).single();

  const { data: standingsRows } = await supabase
    .from('standings')
    .select('team_id, total_kills, total_points, games_played, teams(name)')
    .eq('league_id', leagueId)
    .order('total_points', { ascending: false });

  const { data: allTeams } = await supabase
    .from('league_teams')
    .select('team_id, teams(name)')
    .eq('league_id', leagueId)
    .eq('status', 'approved');

  // Teams with zero results yet don't appear in the standings view (it's
  // grouped from `results`) — merge in the rest at 0 pts so the count/order
  // still reflects every registered team.
  const seen = new Set((standingsRows ?? []).map((r) => r.team_id));
  const zeroRows = (allTeams ?? [])
    .filter((t) => !seen.has(t.team_id))
    .map((t) => ({ team_id: t.team_id, total_kills: 0, total_points: 0, games_played: 0, teams: t.teams }));

  const merged = [...(standingsRows ?? []), ...zeroRows].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));

  const { count: completedGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .eq('status', 'completed');
  const { count: totalGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId);

  return {
    leagueName: league?.name ?? 'League',
    seasonLabel: league?.season_label ?? null,
    completedGames: completedGames ?? 0,
    totalGames: totalGames ?? 0,
    registeredTeams: merged.length,
    rows: merged.map((r, i) => ({
      rank: i + 1,
      teamId: r.team_id as string,
      name: (r.teams as any)?.name ?? 'Team',
      kills: r.total_kills ?? 0,
      points: r.total_points ?? 0,
      gamesPlayed: r.games_played ?? 0,
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
