import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type RosterPlayer = {
  profileId: string;
  name: string;
  initials: string;
  role: string;
  meta: string;
  verified: boolean;
  eligible: boolean;
};

export type TeamLineupData = {
  teamId: string;
  teamName: string;
  leagueName: string | null;
  roster: RosterPlayer[];
  gameId: string | null;
  roundNumber: number | null;
  gameNumber: number | null;
  scheduledAt: string | null;
  lockAt: string | null;
  isLocked: boolean;
  lineupId: string | null;
  confirmedAt: string | null;
  selectedProfileIds: string[];
  pendingSubRequest: { id: string; inProfileId: string; status: string; decidedAt: string | null } | null;
};

function personMeta(row: { rank_name: string | null; kd: number | null; apex_verified_at: string | null }) {
  if (!row.apex_verified_at) return 'Awaiting EA link';
  const rank = row.rank_name ?? 'Unranked';
  const kd = row.kd != null ? `${row.kd.toFixed(2)} K/D` : '';
  return kd ? `${rank} · ${kd}` : rank;
}

async function fetchTeamLineup(teamId: string): Promise<TeamLineupData> {
  const { data: team } = await supabase.from('teams').select('id, name').eq('id', teamId).single();

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    // player_stats has no direct FK to team_members (both reference
    // profiles independently), so PostgREST can only embed it nested
    // under profiles, not as a sibling — a sibling embed 400s.
    .select('profile_id, role, profiles(gamertag, apex_verified_at, player_stats(rank_name, kd))')
    .eq('team_id', teamId);
  if (membersError) throw membersError;

  const roster: RosterPlayer[] = (members ?? []).map((m) => {
    const profile = m.profiles as any;
    const stats = profile?.player_stats as any;
    const verified = !!profile?.apex_verified_at;
    return {
      profileId: m.profile_id,
      name: profile?.gamertag ?? 'Player',
      initials: (profile?.gamertag ?? '??').slice(0, 2).toUpperCase(),
      role: m.role,
      meta: personMeta({ rank_name: stats?.rank_name ?? null, kd: stats?.kd ?? null, apex_verified_at: profile?.apex_verified_at ?? null }),
      verified,
      eligible: verified,
    };
  });

  const { data: leagueTeam } = await supabase
    .from('league_teams')
    .select('league_id, leagues(name)')
    .eq('team_id', teamId)
    .eq('status', 'approved')
    .maybeSingle();

  let gameId: string | null = null;
  let roundNumber: number | null = null;
  let gameNumber: number | null = null;
  let scheduledAt: string | null = null;
  let lineupId: string | null = null;
  let confirmedAt: string | null = null;
  let lockedAtDb: string | null = null;
  let selectedProfileIds: string[] = [];
  let pendingSubRequest: TeamLineupData['pendingSubRequest'] = null;

  if (leagueTeam) {
    const { data: game } = await supabase
      .from('games')
      .select('id, round_number, game_number, scheduled_at')
      .eq('league_id', leagueTeam.league_id)
      .in('status', ['scheduled', 'lobby_open'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (game) {
      gameId = game.id;
      roundNumber = game.round_number;
      gameNumber = game.game_number;
      scheduledAt = game.scheduled_at;

      const { data: lineup } = await supabase
        .from('lineups')
        .select('id, confirmed_at, locked_at')
        .eq('game_id', game.id)
        .eq('team_id', teamId)
        .maybeSingle();

      if (lineup) {
        lineupId = lineup.id;
        confirmedAt = lineup.confirmed_at;
        lockedAtDb = lineup.locked_at;
        const { data: players } = await supabase.from('lineup_players').select('profile_id').eq('lineup_id', lineup.id);
        selectedProfileIds = (players ?? []).map((p) => p.profile_id);
      }

      const { data: subReq } = await supabase
        .from('substitution_requests')
        .select('id, in_profile_id, status, decided_at')
        .eq('game_id', game.id)
        .eq('team_id', teamId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subReq) {
        pendingSubRequest = { id: subReq.id, inProfileId: subReq.in_profile_id, status: subReq.status, decidedAt: subReq.decided_at };
      }
    }
  }

  const isLocked = !!lockedAtDb || (!!scheduledAt && Date.now() >= new Date(scheduledAt).getTime() - 10 * 60_000);
  const lockAt = scheduledAt ? new Date(new Date(scheduledAt).getTime() - 10 * 60_000).toISOString() : null;

  return {
    teamId,
    teamName: team?.name ?? 'Team',
    leagueName: (leagueTeam?.leagues as any)?.name ?? null,
    roster,
    gameId,
    roundNumber,
    gameNumber,
    scheduledAt,
    lockAt,
    isLocked,
    lineupId,
    confirmedAt,
    selectedProfileIds,
    pendingSubRequest,
  };
}

export function useTeamLineup(teamId: string | undefined) {
  return useQuery({
    queryKey: ['teamLineup', teamId],
    queryFn: () => fetchTeamLineup(teamId as string),
    enabled: !!teamId,
    refetchInterval: 30_000,
  });
}

/** Replaces the lineup_players set for `lineupId` (creating the lineup row
 * if needed) and optionally confirms it. Blocked by RLS once locked or past
 * T-10m — this is a convenience wrapper, not the enforcement. */
export function useSetLineup(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gameId,
      lineupId,
      profileIds,
      confirm,
    }: {
      gameId: string;
      lineupId: string | null;
      profileIds: string[];
      confirm: boolean;
    }) => {
      let id = lineupId;
      if (!id) {
        const { data, error } = await supabase
          .from('lineups')
          .insert({ game_id: gameId, team_id: teamId })
          .select('id')
          .single();
        if (error || !data) throw error ?? new Error('Failed to start lineup');
        id = data.id;
      }

      const { error: deleteError } = await supabase.from('lineup_players').delete().eq('lineup_id', id);
      if (deleteError) throw deleteError;

      if (profileIds.length > 0) {
        const { error: insertError } = await supabase
          .from('lineup_players')
          .insert(profileIds.map((profileId) => ({ lineup_id: id, profile_id: profileId })));
        if (insertError) throw insertError;
      }

      if (confirm) {
        const { error: confirmError } = await supabase
          .from('lineups')
          .update({ confirmed_at: new Date().toISOString() })
          .eq('id', id);
        if (confirmError) throw confirmError;
      } else {
        // Selection changed after a previous confirm — clear it so the UI
        // doesn't show a stale "confirmed" state for a different roster.
        const { error: clearError } = await supabase.from('lineups').update({ confirmed_at: null }).eq('id', id);
        if (clearError) throw clearError;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamLineup', teamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRequestSubstitution(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gameId,
      outProfileId,
      inProfileId,
      reason,
      requestedBy,
    }: {
      gameId: string;
      outProfileId: string;
      inProfileId: string;
      reason?: string;
      requestedBy: string;
    }) => {
      const { error } = await supabase.from('substitution_requests').insert({
        game_id: gameId,
        team_id: teamId,
        out_profile_id: outProfileId,
        in_profile_id: inProfileId,
        reason: reason ?? null,
        requested_by: requestedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamLineup', teamId] });
    },
  });
}
