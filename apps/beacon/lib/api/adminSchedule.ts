import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AdminGame = {
  id: string;
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string;
  map: string | null;
  status: string;
  lobbyCode: string | null;
};

async function fetchAdminGames(leagueId: string): Promise<AdminGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, round_number, game_number, scheduled_at, map, status, lobby_code')
    .eq('league_id', leagueId)
    .in('status', ['scheduled', 'lobby_open', 'in_progress', 'cancelled'])
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((g) => ({
    id: g.id,
    roundNumber: g.round_number,
    gameNumber: g.game_number,
    scheduledAt: g.scheduled_at,
    map: g.map,
    status: g.status,
    lobbyCode: g.lobby_code,
  }));
}

export function useAdminGames(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['adminGames', leagueId],
    queryFn: () => fetchAdminGames(leagueId as string),
    enabled: !!leagueId,
    refetchInterval: 30_000,
  });
}

async function fetchApprovedTeamCount(leagueId: string): Promise<number> {
  const { count } = await supabase
    .from('league_teams')
    .select('team_id', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .eq('status', 'approved');
  return count ?? 0;
}

export function useApprovedTeamCount(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['adminApprovedTeamCount', leagueId],
    queryFn: () => fetchApprovedTeamCount(leagueId as string),
    enabled: !!leagueId,
  });
}

export type GameFormData = {
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string; // ISO
  map: string;
  lobbyCode: string | null;
};

export function useSaveGame(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, form }: { gameId?: string; form: GameFormData }) => {
      const payload = {
        round_number: form.roundNumber,
        game_number: form.gameNumber,
        scheduled_at: form.scheduledAt,
        map: form.map,
        lobby_code: form.lobbyCode,
      };
      if (gameId) {
        const { error } = await supabase.from('games').update(payload).eq('id', gameId);
        if (error) throw error;
        return gameId;
      }
      // Insert is the moment the DB's games_notify_new_match trigger fires
      // (only when the league is published) — there is no separate
      // "publish" step for an individual game.
      const { data, error } = await supabase
        .from('games')
        .insert({ ...payload, league_id: leagueId as string, status: 'scheduled' })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Failed to create game');
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGames', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

/** Lets an admin set, replace, or clear a game's real private-match code
 * straight from the schedule list — not just from the live monitor
 * screen, which is unreachable until the game is already
 * lobby_open/in_progress. `lobbyCode: null` clears it back to unset. */
export function useSetGameLobbyCode(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, lobbyCode }: { gameId: string; lobbyCode: string | null }) => {
      const { error } = await supabase.from('games').update({ lobby_code: lobbyCode }).eq('id', gameId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGames', leagueId] });
    },
  });
}

/** The only thing that ever moves a game out of "scheduled" was the
 * "Advance to lobby open" button on the live monitor screen — but that
 * screen is only linked to from here once a game is already live, which
 * it never was yet. Give the schedule table its own way to open the
 * lobby directly, so a freshly published game isn't a dead end. Never
 * fabricates a lobby code — if one hasn't been entered yet, the lobby
 * opens without one and an admin sets the real one when they have it. */
export function useOpenLobby(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.from('games').update({ status: 'lobby_open' }).eq('id', gameId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGames', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

export function useCancelGame(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.from('games').update({ status: 'cancelled' }).eq('id', gameId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGames', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}
