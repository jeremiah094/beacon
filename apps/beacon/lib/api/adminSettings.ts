import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type LeagueDefaults = {
  region: string;
  teamsPerLobby: number;
  maps: string[];
};

const FALLBACK: LeagueDefaults = {
  region: 'Ireland-wide',
  teamsPerLobby: 20,
  maps: ['Storm Point', "World's Edge", 'Broken Moon', 'Olympus'],
};

async function fetchLeagueDefaults(): Promise<LeagueDefaults> {
  const { data } = await supabase
    .from('league_defaults')
    .select('default_region, default_teams_per_lobby, default_maps')
    .eq('id', true)
    .single();
  return {
    region: data?.default_region ?? FALLBACK.region,
    teamsPerLobby: data?.default_teams_per_lobby ?? FALLBACK.teamsPerLobby,
    maps: data?.default_maps ?? FALLBACK.maps,
  };
}

export function useLeagueDefaults() {
  return useQuery({ queryKey: ['leagueDefaults'], queryFn: fetchLeagueDefaults });
}

export function useSaveLeagueDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeagueDefaults) => {
      const { error } = await supabase
        .from('league_defaults')
        .update({
          default_region: input.region,
          default_teams_per_lobby: input.teamsPerLobby,
          default_maps: input.maps,
        })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagueDefaults'] });
    },
  });
}
