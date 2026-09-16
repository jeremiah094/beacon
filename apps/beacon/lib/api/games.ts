import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type UpcomingGame = {
  id: string;
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string;
  lockAt: string;
  map: string | null;
  muted: boolean;
  lobbyCode: string | null;
};

export type UpcomingGamesData = {
  teamName: string;
  leagueName: string | null;
  games: UpcomingGame[];
};

async function fetchUpcomingGames(teamId: string, userId: string): Promise<UpcomingGamesData> {
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();

  const { data: leagueTeam } = await supabase
    .from('league_teams')
    .select('league_id, leagues(name)')
    .eq('team_id', teamId)
    .eq('status', 'approved')
    .maybeSingle();

  if (!leagueTeam) {
    return { teamName: team?.name ?? 'Team', leagueName: null, games: [] };
  }

  const { data: games } = await supabase
    .from('games')
    .select('id, round_number, game_number, scheduled_at, map, lobby_code')
    .eq('league_id', leagueTeam.league_id)
    .in('status', ['scheduled', 'lobby_open'])
    .order('scheduled_at', { ascending: true });

  const gameIds = (games ?? []).map((g) => g.id);
  const { data: prefs } = gameIds.length
    ? await supabase.from('notification_prefs').select('game_id, muted').eq('profile_id', userId).in('game_id', gameIds)
    : { data: [] as { game_id: string; muted: boolean }[] };
  const mutedSet = new Set((prefs ?? []).filter((p) => p.muted).map((p) => p.game_id));

  return {
    teamName: team?.name ?? 'Team',
    leagueName: (leagueTeam.leagues as any)?.name ?? null,
    games: (games ?? []).map((g) => ({
      id: g.id,
      roundNumber: g.round_number,
      gameNumber: g.game_number,
      scheduledAt: g.scheduled_at,
      lockAt: new Date(new Date(g.scheduled_at).getTime() - 10 * 60_000).toISOString(),
      map: g.map,
      muted: mutedSet.has(g.id),
      lobbyCode: g.lobby_code,
    })),
  };
}

export function useUpcomingGames(teamId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['upcomingGames', teamId, userId],
    queryFn: () => fetchUpcomingGames(teamId as string, userId as string),
    enabled: !!teamId && !!userId,
  });
}

export function useToggleGameMute(teamId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, muted }: { gameId: string; muted: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('notification_prefs')
        .upsert({ profile_id: userId, game_id: gameId, muted }, { onConflict: 'profile_id,game_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingGames', teamId, userId] });
    },
  });
}
