import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type MyTeam = {
  id: string;
  name: string;
  initials: string;
  role: string;
  leagueId: string | null;
  leagueName: string | null;
  registrationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  meta: string;
};

async function fetchMyTeams(userId: string): Promise<MyTeam[]> {
  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, role, teams(id, name, tag)')
    .eq('profile_id', userId);

  if (!memberships || memberships.length === 0) return [];

  const teamIds = memberships.map((m) => m.team_id);

  const { data: registrations } = await supabase
    .from('league_teams')
    .select('team_id, league_id, status, leagues(name)')
    .in('team_id', teamIds);

  const regByTeam = new Map<string, { leagueId: string; leagueName: string; status: string }>();
  for (const r of registrations ?? []) {
    // Last one wins — a team registering for a new league after leaving one is the common case.
    regByTeam.set(r.team_id, { leagueId: r.league_id, leagueName: (r.leagues as any)?.name ?? '', status: r.status });
  }

  const teams = await Promise.all(
    memberships.map(async (m) => {
      const team = m.teams as any;
      const reg = regByTeam.get(m.team_id);
      let meta = 'No league yet';

      if (reg?.status === 'pending') {
        meta = `Awaiting approval · ${reg.leagueName}`;
      } else if (reg?.status === 'rejected') {
        meta = 'Registration declined';
      } else if (reg?.status === 'approved') {
        const [{ data: allStandings }, { data: nextGames }] = await Promise.all([
          supabase.from('standings').select('team_id, total_points').eq('league_id', reg.leagueId),
          supabase
            .from('games')
            .select('scheduled_at')
            .eq('league_id', reg.leagueId)
            .in('status', ['scheduled', 'lobby_open'])
            .order('scheduled_at', { ascending: true })
            .limit(1),
        ]);
        const total = allStandings?.length ?? 0;
        const rank = allStandings
          ? [...allStandings].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0)).findIndex((r) => r.team_id === m.team_id) + 1
          : 0;
        const rankLabel = rank > 0 ? `${rank}${ordinalSuffix(rank)} of ${total}` : `of ${total}`;
        const next = nextGames?.[0]
          ? `next match ${new Date(nextGames[0].scheduled_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
          : 'no fixtures yet';
        meta = `${rankLabel} · ${next}`;
      }

      return {
        id: m.team_id,
        name: team?.name ?? 'Team',
        initials: (team?.tag as string | undefined)?.slice(0, 2).toUpperCase() ?? (team?.name ?? '??').slice(0, 2).toUpperCase(),
        role: m.role,
        leagueId: reg?.leagueId ?? null,
        leagueName: reg?.leagueName ?? null,
        registrationStatus: (reg?.status as MyTeam['registrationStatus']) ?? 'none',
        meta,
      };
    }),
  );

  return teams;
}

function ordinalSuffix(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function useMyTeams(userId: string | undefined) {
  return useQuery({
    queryKey: ['myTeams', userId],
    queryFn: () => fetchMyTeams(userId as string),
    enabled: !!userId,
  });
}

export function useCreateTeam(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, tag, joinLeagueId }: { name: string; tag: string; joinLeagueId?: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name, tag: tag || null, captain_id: userId })
        .select('id')
        .single();
      if (teamError || !team) throw teamError ?? new Error('Failed to create team');

      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, profile_id: userId, role: 'captain' });
      if (memberError) throw memberError;

      if (joinLeagueId) {
        const { error: regError } = await supabase
          .from('league_teams')
          .insert({ league_id: joinLeagueId, team_id: team.id, status: 'pending' });
        if (regError) throw regError;
      }

      return team.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTeams', userId] });
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
  });
}
