import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type LeagueSummary = {
  id: string;
  name: string;
  format: string;
  teamsPerLobby: number;
  seasonLabel: string | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  entryRules: string | null;
  registeredCount: number;
  isOpen: boolean;
};

async function fetchLeagues(): Promise<LeagueSummary[]> {
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, format, teams_per_lobby, season_label, season_start, season_end, entry_rules')
    .eq('status', 'published');

  if (!leagues || leagues.length === 0) return [];

  const { data: registrations } = await supabase
    .from('league_teams')
    .select('league_id, status')
    .in('league_id', leagues.map((l) => l.id))
    .in('status', ['pending', 'approved']);

  const counts = new Map<string, number>();
  for (const r of registrations ?? []) {
    counts.set(r.league_id, (counts.get(r.league_id) ?? 0) + 1);
  }

  return leagues.map((l) => {
    const registeredCount = counts.get(l.id) ?? 0;
    return {
      id: l.id,
      name: l.name,
      format: l.format,
      teamsPerLobby: l.teams_per_lobby,
      seasonLabel: l.season_label,
      seasonStart: l.season_start,
      seasonEnd: l.season_end,
      entryRules: l.entry_rules,
      registeredCount,
      isOpen: registeredCount < l.teams_per_lobby,
    };
  });
}

export function useLeagues() {
  return useQuery({ queryKey: ['leagues'], queryFn: fetchLeagues });
}
