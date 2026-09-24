import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AdminLeagueSummary = {
  id: string;
  name: string;
  status: string;
  registeredTeams: number;
  pendingTeams: number;
};

async function fetchAdminLeagues(): Promise<AdminLeagueSummary[]> {
  const { data: leagues } = await supabase.from('leagues').select('id, name, status').order('created_at', { ascending: false });
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

export function useAdminLeagues() {
  return useQuery({ queryKey: ['adminLeagues'], queryFn: fetchAdminLeagues });
}

export type LeagueFormData = {
  name: string;
  seasonLabel: string;
  region: string;
  teamsPerLobby: number;
  seasonStart: string; // ISO date
  seasonEnd: string; // ISO date
  entryRules: string;
};

async function fetchLeague(leagueId: string) {
  const { data } = await supabase
    .from('leagues')
    .select('id, name, season_label, region, teams_per_lobby, season_start, season_end, entry_rules, status')
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

export function useSaveLeague(leagueId: string | undefined, userId: string | undefined) {
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
        format: 'battle_royale',
        ...(publish ? { status: 'published' } : {}),
      };

      const duplicateMessage = `A league named "${form.name}"${form.seasonLabel ? ` for ${form.seasonLabel}` : ''} already exists.`;

      if (leagueId) {
        const { error } = await supabase.from('leagues').update(payload).eq('id', leagueId);
        if (error?.code === '23505') throw new Error(duplicateMessage);
        if (error) throw error;
        return leagueId;
      }

      const { data, error } = await supabase
        .from('leagues')
        .insert({ ...payload, status: publish ? 'published' : 'draft', created_by: userId })
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
