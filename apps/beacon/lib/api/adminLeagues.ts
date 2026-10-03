import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AdminLeagueSummary = {
  id: string;
  name: string;
  status: string;
  registeredTeams: number;
  pendingTeams: number;
};

async function fetchAdminLeagues(titleSlug: string, userId: string): Promise<AdminLeagueSummary[]> {
  // Admin-scoped leagues (decentralized-leagues option 1): RLS already
  // lets any admin read every *published* league (players need that), so
  // this screen needs its own explicit filter on top to show only the
  // leagues this admin actually created — otherwise another admin's
  // published league would still show up here once it goes live.
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, status, titles!inner(slug)')
    .eq('titles.slug', titleSlug)
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  if (!leagues || leagues.length === 0) return [];

  const { data: regs } = await supabase
    .from('league_teams')
    .select('league_id, status')
    .in(
      'league_id',
      leagues.map((l) => l.id),
    );

  return leagues.map((l) => {
    const forLeague = (regs ?? []).filter((r) => r.league_id === l.id);
    return {
      id: l.id,
      name: l.name,
      status: l.status,
      registeredTeams: forLeague.filter((r) => r.status === 'approved').length,
      pendingTeams: forLeague.filter((r) => r.status === 'pending').length,
    };
  });
}

export function useAdminLeagues(titleSlug: string = 'apex', userId: string | undefined = undefined) {
  return useQuery({
    queryKey: ['adminLeagues', titleSlug, userId],
    queryFn: () => fetchAdminLeagues(titleSlug, userId as string),
    enabled: !!userId,
  });
}

export type LeagueFormData = {
  name: string;
  seasonLabel: string;
  region: string;
  teamsPerLobby: number;
  seasonStart: string; // ISO date
  seasonEnd: string; // ISO date
  entryRules: string;
  /** Head-to-head only — how many times each pair of teams plays each
   * other. Omitted (not sent) for battle_royale leagues. */
  gamesPerOpponent?: 1 | 2;
};

async function fetchLeague(leagueId: string) {
  const { data } = await supabase
    .from('leagues')
    .select(
      'id, name, season_label, region, teams_per_lobby, season_start, season_end, entry_rules, status, games_per_opponent, titles(slug, name, format_type)',
    )
    .eq('id', leagueId)
    .single();
  return data;
}

export function useAdminLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['adminLeague', leagueId],
    queryFn: () => fetchLeague(leagueId as string),
    enabled: !!leagueId,
  });
}

export function useSaveLeague(leagueId: string | undefined, userId: string | undefined, titleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ form, publish }: { form: LeagueFormData; publish: boolean }) => {
      const payload = {
        name: form.name,
        season_label: form.seasonLabel || null,
        region: form.region,
        teams_per_lobby: form.teamsPerLobby,
        season_start: form.seasonStart || null,
        season_end: form.seasonEnd || null,
        entry_rules: form.entryRules || null,
        // Omitted entirely (not sent as null) for a battle_royale league,
        // so a form that never collected it can't accidentally clear it.
        ...(form.gamesPerOpponent !== undefined ? { games_per_opponent: form.gamesPerOpponent } : {}),
        ...(publish ? { status: 'published' } : {}),
      };

      const duplicateMessage = `A league named "${form.name}"${form.seasonLabel ? ` for ${form.seasonLabel}` : ''} already exists.`;
      // leagues_lock_games_per_opponent (DB trigger) raises a plain
      // exception — e.g. "Vipers played against Shannon Aces twice
      // already — the number of games per team can't be changed once a
      // pairing has completed both matches." — which surfaces as-is via
      // error.message below, same as the duplicate-name case.

      if (leagueId) {
        // title_id is immutable once set — deliberately left out of this
        // payload. It used to be re-sent unconditionally here, which meant
        // editing a league while the admin console happened to be in a
        // different game's context would silently retype it.
        const { error } = await supabase.from('leagues').update(payload).eq('id', leagueId);
        if (error?.code === '23505') throw new Error(duplicateMessage);
        if (error) throw error;
        return leagueId;
      }

      if (!titleId) throw new Error('Could not resolve the active game — try again.');
      const { data, error } = await supabase
        .from('leagues')
        .insert({ ...payload, title_id: titleId, status: publish ? 'published' : 'draft', created_by: userId })
        .select('id')
        .single();
      if (error?.code === '23505') throw new Error(duplicateMessage);
      if (error || !data) throw error ?? new Error('Failed to create league');
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['adminLeagues'] });
      queryClient.invalidateQueries({ queryKey: ['adminLeague', id] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

/** RLS (`leagues_write`) already covers DELETE for admins, and every child
 * row — games, league_teams, results, lineups, lineup_players,
 * substitutions — cascades on the league's deletion, so this is a plain
 * single-table delete. */
export function useDeleteLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leagueId: string) => {
      const { error } = await supabase.from('leagues').delete().eq('id', leagueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLeagues'] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}
