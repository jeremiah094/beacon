import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type ApprovalPlayer = {
  profileId: string;
  name: string;
  role: 'captain' | 'member' | 'sub';
  eaId: string | null;
  rank: string | null;
  verified: boolean;
};

export type ApprovalTeam = {
  teamId: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
  rejectionReason: string | null;
  captainName: string;
  roster: ApprovalPlayer[];
  verifiedCount: number;
};

type Row = {
  team_id: string;
  status: string;
  rejection_reason: string | null;
  registered_at: string;
  teams: {
    id: string;
    name: string;
    team_members: {
      role: string;
      profiles: {
        id: string;
        gamertag: string | null;
        display_name: string | null;
        apex_uid: string | null;
        apex_verified_at: string | null;
        player_stats: { rank_name: string | null } | null;
      } | null;
    }[];
  } | null;
};

async function fetchApprovalQueue(leagueId: string): Promise<ApprovalTeam[]> {
  const { data, error } = await supabase
    .from('league_teams')
    .select(
      'team_id, status, rejection_reason, registered_at, teams(id, name, team_members(role, profiles(id, gamertag, display_name, apex_uid, apex_verified_at, player_stats(rank_name))))',
    )
    .eq('league_id', leagueId)
    .order('registered_at', { ascending: true })
    .returns<Row[]>();
  if (error) throw error;

  return (data ?? [])
    .filter((r) => r.teams)
    .map((r) => {
      const team = r.teams!;
      const roster: ApprovalPlayer[] = team.team_members
        .filter((m) => m.profiles)
        .map((m) => {
          const p = m.profiles!;
          return {
            profileId: p.id,
            name: p.display_name || p.gamertag || 'Unnamed player',
            role: (m.role as ApprovalPlayer['role']) ?? 'member',
            eaId: p.apex_uid,
            rank: p.player_stats?.rank_name ?? null,
            verified: !!p.apex_verified_at,
          };
        })
        .sort((a, b) => (a.role === 'captain' ? -1 : b.role === 'captain' ? 1 : 0));

      return {
        teamId: r.team_id,
        name: team.name,
        status: r.status as ApprovalTeam['status'],
        registeredAt: r.registered_at,
        rejectionReason: r.rejection_reason,
        captainName: roster.find((p) => p.role === 'captain')?.name ?? '—',
        roster,
        verifiedCount: roster.filter((p) => p.verified).length,
      };
    });
}

export function useApprovalQueue(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['adminApprovalQueue', leagueId],
    queryFn: () => fetchApprovalQueue(leagueId as string),
    enabled: !!leagueId,
  });
}

export function useDecideTeam(leagueId: string | undefined, adminId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      decision,
      reason,
    }: {
      teamId: string;
      decision: 'approved' | 'rejected' | 'pending';
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('league_teams')
        .update({
          status: decision,
          rejection_reason: decision === 'rejected' ? (reason ?? null) : null,
          decided_by: decision === 'pending' ? null : adminId,
          decided_at: decision === 'pending' ? null : new Date().toISOString(),
        })
        .eq('league_id', leagueId as string)
        .eq('team_id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminApprovalQueue', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
      queryClient.invalidateQueries({ queryKey: ['adminLeagues'] });
    },
  });
}
