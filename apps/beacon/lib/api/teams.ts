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
      if (teamError?.code === '23505') {
        throw new Error(`A team called "${name}" already exists — search for it and ask to join instead of creating a duplicate.`);
      }
      if (teamError || !team) throw teamError ?? new Error('Failed to create team');

      // The on_team_created trigger adds the captain to team_members
      // server-side, in the same transaction as the insert above.

      if (joinLeagueId) {
        const { error: regError } = await supabase
          .from('league_teams')
          .insert({ league_id: joinLeagueId, team_id: team.id, status: 'pending', registered_at: new Date().toISOString() });
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

/** Registers a team the player already has (rather than creating a new
 * one) for a league. league_teams_insert requires the caller be that
 * team's captain — teammates picking this option will hit an RLS error,
 * surfaced as-is since the "Register" action is only ever shown to the
 * captain in the UI. */
export function useRegisterTeamForLeague(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, leagueId }: { teamId: string; leagueId: string }) => {
      const { error } = await supabase
        .from('league_teams')
        .insert({ league_id: leagueId, team_id: teamId, status: 'pending', registered_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTeams', userId] });
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
  });
}

export type TeamSearchResult = { id: string; name: string; tag: string | null; initials: string };

/** teams_select_search (RLS) intentionally opens SELECT on teams to every
 * authenticated user — name/tag aren't sensitive, and finding a team you
 * don't already share a league or membership with is the whole point of
 * search-to-join. */
export function useSearchTeams(query: string, excludeTeamIds: string[]) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['teamSearch', trimmed],
    queryFn: async (): Promise<TeamSearchResult[]> => {
      const { data, error } = await supabase.from('teams').select('id, name, tag').ilike('name', `%${trimmed}%`).order('name').limit(20);
      if (error) throw error;
      return (data ?? [])
        .filter((t) => !excludeTeamIds.includes(t.id))
        .map((t) => ({ id: t.id, name: t.name, tag: t.tag, initials: (t.tag || t.name).slice(0, 2).toUpperCase() }));
    },
    enabled: trimmed.length >= 2,
  });
}

/** Team IDs this player already has a pending join request against —
 * lets the search screen show "Requested" instead of "Join" so they
 * can't spam the same team (team_join_requests_one_pending also
 * enforces this server-side either way). */
export function useMyPendingJoinRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['myJoinRequests', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_join_requests').select('team_id').eq('profile_id', userId as string).eq('status', 'pending');
      if (error) throw error;
      return (data ?? []).map((r) => r.team_id);
    },
    enabled: !!userId,
  });
}

export function useRequestToJoinTeam(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('team_join_requests').insert({ team_id: teamId, profile_id: userId });
      if (error?.code === '23505') {
        throw new Error("You've already asked to join this team — waiting on the captain to respond.");
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myJoinRequests', userId] });
    },
  });
}
