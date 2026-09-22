import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type LineupState = 'not_set' | 'pending' | 'locked' | 'sub_pending';

export type MonitorTeam = {
  teamId: string;
  name: string;
  captainName: string;
  lineupState: LineupState;
  pendingSub: {
    requestId: string;
    outProfileId: string;
    outName: string;
    inProfileId: string;
    inName: string;
    reason: string | null;
    requestedAt: string;
  } | null;
};

export type AuditEntry = { at: string; text: string };

export type MonitorGame = {
  id: string;
  leagueId: string;
  leagueName: string;
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string;
  map: string | null;
  status: string;
  lobbyCode: string | null;
  lineupLockedAt: string | null;
  teams: MonitorTeam[];
  auditLog: AuditEntry[];
};

function displayName(p: { display_name: string | null; gamertag: string | null } | null | undefined): string {
  return p?.display_name || p?.gamertag || 'Player';
}

async function fetchMonitor(gameId: string): Promise<MonitorGame> {
  const { data: game, error } = await supabase
    .from('games')
    .select('id, league_id, round_number, game_number, scheduled_at, map, status, lobby_code, lineup_locked_at, leagues(name)')
    .eq('id', gameId)
    .single();
  if (error || !game) throw error ?? new Error('Game not found');

  const { data: approved } = await supabase
    .from('league_teams')
    .select('team_id, teams(id, name, captain_id, profiles(display_name, gamertag))')
    .eq('league_id', game.league_id)
    .eq('status', 'approved');

  const { data: lineups } = await supabase.from('lineups').select('id, team_id, confirmed_at, locked_at').eq('game_id', gameId);
  const lineupByTeam = new Map((lineups ?? []).map((l) => [l.team_id, l]));

  const { data: subs } = await supabase
    .from('substitution_requests')
    .select(
      'id, team_id, status, reason, requested_at, decided_at, out_profile_id, in_profile_id, out:profiles!substitution_requests_out_profile_id_fkey(display_name, gamertag), in:profiles!substitution_requests_in_profile_id_fkey(display_name, gamertag)',
    )
    .eq('game_id', gameId)
    .order('requested_at', { ascending: false })
    .limit(10);
  const subByTeam = new Map((subs ?? []).filter((s) => s.status === 'pending').map((s) => [s.team_id, s]));

  const teams: MonitorTeam[] = (approved ?? [])
    .filter((r) => r.teams)
    .map((r) => {
      const t = r.teams!;
      const lineup = lineupByTeam.get(t.id);
      const sub = subByTeam.get(t.id);
      let lineupState: LineupState = 'not_set';
      if (sub) lineupState = 'sub_pending';
      else if (lineup?.locked_at) lineupState = 'locked';
      else if (lineup) lineupState = 'pending';

      return {
        teamId: t.id,
        name: t.name,
        captainName: displayName(t.profiles as any),
        lineupState,
        pendingSub: sub
          ? {
              requestId: sub.id,
              outProfileId: sub.out_profile_id,
              outName: displayName(sub.out as any),
              inProfileId: sub.in_profile_id,
              inName: displayName(sub.in as any),
              reason: sub.reason,
              requestedAt: sub.requested_at,
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const auditLog: AuditEntry[] = [];
  if (game.lineup_locked_at) {
    auditLog.push({ at: game.lineup_locked_at, text: `Lineups locked for ${teams.filter((t) => t.lineupState !== 'not_set').length} teams` });
  }
  if (game.lobby_code) {
    auditLog.push({ at: game.lineup_locked_at ?? game.scheduled_at, text: `Lobby code ${game.lobby_code} issued to captains` });
  }
  for (const s of subs ?? []) {
    const outName = displayName(s.out as any);
    const inName = displayName(s.in as any);
    if (s.status === 'pending') {
      auditLog.push({ at: s.requested_at, text: `Substitution requested: ${outName} → ${inName}` });
    } else if (s.decided_at) {
      auditLog.push({ at: s.decided_at, text: `Substitution ${s.status}: ${outName} → ${inName}` });
    }
  }
  auditLog.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    id: game.id,
    leagueId: game.league_id,
    leagueName: (game.leagues as any)?.name ?? 'League',
    roundNumber: game.round_number,
    gameNumber: game.game_number,
    scheduledAt: game.scheduled_at,
    map: game.map,
    status: game.status,
    lobbyCode: game.lobby_code,
    lineupLockedAt: game.lineup_locked_at,
    teams,
    auditLog: auditLog.slice(0, 5),
  };
}

export function useMonitorGame(gameId: string | undefined) {
  return useQuery({
    queryKey: ['adminMonitor', gameId],
    queryFn: () => fetchMonitor(gameId as string),
    enabled: !!gameId,
    refetchInterval: 15_000,
  });
}

function randomLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function useAdvanceGamePhase(gameId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nextStatus, currentLobbyCode }: { nextStatus: string; currentLobbyCode: string | null }) => {
      const payload: { status: string; lobby_code?: string } = { status: nextStatus };
      if (nextStatus === 'lobby_open' && !currentLobbyCode) payload.lobby_code = randomLobbyCode();
      const { error } = await supabase.from('games').update(payload).eq('id', gameId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMonitor', gameId] });
      queryClient.invalidateQueries({ queryKey: ['adminGames'] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

/** Lets an admin type in the real private-match code they created in
 * Apex, instead of relying on the random placeholder assigned when the
 * lobby opens. Writing it here is what makes it show up for every
 * approved team on their match lobby screen (useMatchLobby subscribes
 * to Realtime on this row). */
export function useSetLobbyCode(gameId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lobbyCode: string | null) => {
      const { error } = await supabase.from('games').update({ lobby_code: lobbyCode }).eq('id', gameId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMonitor', gameId] });
    },
  });
}

export function useDecideSubstitution(gameId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      teamId,
      approve,
      adminId,
      outProfileId,
      inProfileId,
    }: {
      requestId: string;
      teamId: string;
      approve: boolean;
      adminId: string;
      outProfileId?: string;
      inProfileId?: string;
    }) => {
      const { error: decideError } = await supabase
        .from('substitution_requests')
        .update({ status: approve ? 'approved' : 'denied', decided_by: adminId, decided_at: new Date().toISOString() })
        .eq('id', requestId);
      if (decideError) throw decideError;

      if (approve && outProfileId && inProfileId) {
        const { data: lineup } = await supabase.from('lineups').select('id').eq('game_id', gameId as string).eq('team_id', teamId).maybeSingle();
        if (lineup) {
          await supabase.from('lineup_players').delete().eq('lineup_id', lineup.id).eq('profile_id', outProfileId);
          await supabase.from('lineup_players').insert({ lineup_id: lineup.id, profile_id: inProfileId });
          await supabase.from('substitutions').insert({
            game_id: gameId as string,
            team_id: teamId,
            out_profile_id: outProfileId,
            in_profile_id: inProfileId,
            reason: 'Admin-approved emergency substitution',
            applied_by: adminId,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMonitor', gameId] });
    },
  });
}
