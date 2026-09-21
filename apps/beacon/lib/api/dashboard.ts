import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type DashboardStats = {
  rankName: string | null;
  rankScore: number | null;
  kd: number | null;
  wins: number | null;
  kills: number | null;
  mostPlayedLegend: string | null;
  fetchedAt: string | null;
};

export type DashboardNextGame = {
  gameId: string;
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string;
  lockAt: string;
  starterCount: number;
  lineupConfirmed: boolean;
};

export type DashboardLeague = {
  leagueId: string;
  leagueName: string;
  teamId: string;
  teamName: string;
  role: string;
  standingRank: number | null;
  standingTotal: number;
  points: number;
  totalRounds: number;
  nextGame: DashboardNextGame | null;
};

export type DashboardData = {
  gamertag: string | null;
  displayName: string | null;
  isVerified: boolean;
  stats: DashboardStats | null;
  league: DashboardLeague | null;
  hasAnyTeam: boolean;
};

async function fetchDashboard(userId: string): Promise<DashboardData> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('gamertag, display_name, apex_verified_at')
    .eq('id', userId)
    .single();

  const { data: statsRow } = await supabase
    .from('player_stats')
    .select('rank_name, rank_score, kd, wins, kills, most_played_legend, fetched_at')
    .eq('profile_id', userId)
    .maybeSingle();

  const stats: DashboardStats | null = statsRow
    ? {
        rankName: statsRow.rank_name,
        rankScore: statsRow.rank_score,
        kd: statsRow.kd,
        wins: statsRow.wins,
        kills: statsRow.kills,
        mostPlayedLegend: statsRow.most_played_legend,
        fetchedAt: statsRow.fetched_at,
      }
    : null;

  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, role, teams(name)')
    .eq('profile_id', userId);

  const hasAnyTeam = !!memberships && memberships.length > 0;
  let league: DashboardLeague | null = null;

  if (memberships && memberships.length > 0) {
    const teamIds = memberships.map((m) => m.team_id);

    const { data: leagueTeams } = await supabase
      .from('league_teams')
      .select('team_id, league_id, leagues(id, name, status)')
      .in('team_id', teamIds)
      .eq('status', 'approved');

    if (leagueTeams && leagueTeams.length > 0) {
      const leagueIds = leagueTeams.map((lt) => lt.league_id);

      const { data: upcomingGames } = await supabase
        .from('games')
        .select('id, league_id, round_number, game_number, scheduled_at, status')
        .in('league_id', leagueIds)
        .in('status', ['scheduled', 'lobby_open'])
        .order('scheduled_at', { ascending: true })
        .limit(1);

      // Pick the league with the soonest game; fall back to the first
      // approved league if nothing is scheduled yet.
      const chosen = upcomingGames?.[0]
        ? leagueTeams.find((lt) => lt.league_id === upcomingGames[0].league_id)!
        : leagueTeams[0];

      const teamId = chosen.team_id;
      const leagueId = chosen.league_id;
      const leagueName = (chosen.leagues as any)?.name ?? 'League';
      const teamName = memberships.find((m) => m.team_id === teamId)?.teams
        ? (memberships.find((m) => m.team_id === teamId)!.teams as any).name
        : '';

      const [{ data: standingsRow }, { count: totalApproved }] = await Promise.all([
        supabase
          .from('standings')
          .select('total_points')
          .eq('league_id', leagueId)
          .eq('team_id', teamId)
          .maybeSingle(),
        supabase
          .from('league_teams')
          .select('team_id', { count: 'exact', head: true })
          .eq('league_id', leagueId)
          .eq('status', 'approved'),
      ]);

      // Standing rank requires ordering the full table — cheap at this
      // scale (<=20 teams/lobby per BUILD.md §2).
      const { data: allStandings } = await supabase
        .from('standings')
        .select('team_id, total_points')
        .eq('league_id', leagueId);
      const rank = allStandings
        ? [...allStandings].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0)).findIndex((r) => r.team_id === teamId) + 1
        : null;

      const { data: allRounds } = await supabase
        .from('games')
        .select('round_number')
        .eq('league_id', leagueId);
      const totalRounds = allRounds ? new Set(allRounds.map((g) => g.round_number)).size : 0;

      let nextGame: DashboardNextGame | null = null;
      const gameRow = upcomingGames?.find((g) => g.league_id === leagueId);
      if (gameRow) {
        const { data: lineup } = await supabase
          .from('lineups')
          .select('id, confirmed_at')
          .eq('game_id', gameRow.id)
          .eq('team_id', teamId)
          .maybeSingle();

        let starterCount = 0;
        if (lineup) {
          const { count } = await supabase
            .from('lineup_players')
            .select('profile_id', { count: 'exact', head: true })
            .eq('lineup_id', lineup.id);
          starterCount = count ?? 0;
        }

        nextGame = {
          gameId: gameRow.id,
          roundNumber: gameRow.round_number,
          gameNumber: gameRow.game_number,
          scheduledAt: gameRow.scheduled_at,
          lockAt: new Date(new Date(gameRow.scheduled_at).getTime() - 10 * 60_000).toISOString(),
          starterCount,
          lineupConfirmed: !!lineup?.confirmed_at,
        };
      }

      league = {
        leagueId,
        leagueName,
        teamId,
        teamName,
        role: memberships.find((m) => m.team_id === teamId)?.role ?? 'member',
        standingRank: rank && rank > 0 ? rank : null,
        standingTotal: totalApproved ?? 0,
        points: standingsRow?.total_points ?? 0,
        totalRounds,
        nextGame,
      };
    }
  }

  return {
    gamertag: profile?.gamertag ?? null,
    displayName: profile?.display_name ?? null,
    isVerified: !!profile?.apex_verified_at,
    stats,
    league,
    hasAnyTeam,
  };
}

export function useDashboard(userId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboard(userId as string),
    enabled: !!userId,
  });
}
