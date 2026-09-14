import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type LobbyPlayer = { profileId: string; name: string; initials: string };

export type MatchLobbyData = {
  teamName: string;
  leagueName: string | null;
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string;
  map: string | null;
  lobbyCode: string | null;
  lockedAt: string | null;
  status: string;
  trio: LobbyPlayer[];
};

async function fetchMatchLobby(gameId: string, teamId: string): Promise<MatchLobbyData> {
  const { data: game } = await supabase
    .from('games')
    .select('round_number, game_number, scheduled_at, map, lobby_code, status, leagues(name)')
    .eq('id', gameId)
    .single();

  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();

  const { data: lineup } = await supabase
    .from('lineups')
    .select('id, locked_at')
    .eq('game_id', gameId)
    .eq('team_id', teamId)
    .maybeSingle();

  let trio: LobbyPlayer[] = [];
  if (lineup) {
    const { data: players } = await supabase
      .from('lineup_players')
      .select('profile_id, profiles(gamertag)')
      .eq('lineup_id', lineup.id);
    trio = (players ?? []).map((p) => {
      const name = (p.profiles as any)?.gamertag ?? 'Player';
      return { profileId: p.profile_id, name, initials: name.slice(0, 2).toUpperCase() };
    });
  }

  return {
    teamName: team?.name ?? 'Team',
    leagueName: (game?.leagues as any)?.name ?? null,
    roundNumber: game?.round_number ?? 0,
    gameNumber: game?.game_number ?? 0,
    scheduledAt: game?.scheduled_at ?? new Date().toISOString(),
    map: game?.map ?? null,
    lobbyCode: game?.lobby_code ?? null,
    lockedAt: lineup?.locked_at ?? null,
    status: game?.status ?? 'scheduled',
    trio,
  };
}

/** Resolves which of the signed-in player's teams this game belongs to —
 * the T-10m push deep-links to `beacon://games/{gameId}/lobby` with no
 * teamId (BUILD.md §5: must work as a cold-start target with zero prior
 * navigation context), so the team has to be derived from the game's
 * league plus the player's own memberships, not passed in. */
export function useResolveTeamForGame(gameId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['resolveTeamForGame', gameId, userId],
    queryFn: async () => {
      const { data: game } = await supabase.from('games').select('league_id').eq('id', gameId as string).single();
      if (!game) return undefined;
      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('profile_id', userId as string);
      const teamIds = (memberships ?? []).map((m) => m.team_id);
      if (teamIds.length === 0) return undefined;
      const { data: reg } = await supabase
        .from('league_teams')
        .select('team_id')
        .eq('league_id', game.league_id)
        .in('team_id', teamIds)
        .eq('status', 'approved')
        .maybeSingle();
      return reg?.team_id;
    },
    enabled: !!gameId && !!userId,
  });
}

/** Live game/lineup state for the match lobby (BUILD.md §5: subscribes to
 * Realtime on `games` and `lineups` — lobby code and status update without
 * a refresh, since the admin may set/change the code close to lobby time). */
export function useMatchLobby(gameId: string | undefined, teamId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['matchLobby', gameId, teamId];

  useEffect(() => {
    if (!gameId || !teamId) return;
    const channel = supabase
      .channel(`match-lobby-${gameId}-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineups', filter: `game_id=eq.${gameId}` },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, teamId, queryClient]);

  return useQuery({
    queryKey,
    queryFn: () => fetchMatchLobby(gameId as string, teamId as string),
    enabled: !!gameId && !!teamId,
  });
}
