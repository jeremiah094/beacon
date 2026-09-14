import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AdminNavCounts = {
  leagues: number;
  pendingApprovals: number;
  scheduled: number;
  live: number;
  results: number;
};

async function fetchAdminNavCounts(): Promise<AdminNavCounts> {
  const [{ count: leagues }, { count: pending }, { count: scheduled }, { count: live }, { count: results }] =
    await Promise.all([
      supabase.from('leagues').select('id', { count: 'exact', head: true }),
      supabase.from('league_teams').select('team_id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('games').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'lobby_open']),
      supabase.from('games').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('games').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    ]);

  return {
    leagues: leagues ?? 0,
    pendingApprovals: pending ?? 0,
    scheduled: scheduled ?? 0,
    live: live ?? 0,
    results: results ?? 0,
  };
}

export function useAdminNavCounts() {
  return useQuery({ queryKey: ['adminNavCounts'], queryFn: fetchAdminNavCounts, refetchInterval: 30_000 });
}

export function useAdminProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['adminProfile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, gamertag')
        .eq('id', userId as string)
        .single();
      const name = data?.display_name ?? data?.gamertag ?? 'Admin';
      return { name, initials: name.slice(0, 2).toUpperCase() };
    },
    enabled: !!userId,
  });
}
