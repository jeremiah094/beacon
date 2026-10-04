import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type FixtureSideStarter = { profileId: string; name: string };

export type FixtureSide = {
  teamId: string;
  teamName: string;
  captainName: string;
  starters: FixtureSideStarter[];
};

export type MonitorFixture = {
  id: string;
  leagueId: string;
  leagueName: string;
  roundNumber: number;
  bestOf: number;
  scheduledAt: string;
  status: string;
  lobbyCode: string | null;
  lineupLockedAt: string | null;
  home: FixtureSide;
  away: FixtureSide;
  homeMapsWon: number;
  awayMapsWon: number;
  observerId: string | null;
  observerName: string | null;
  observerTwitchLogin: string | null;
  streamLive: boolean;
  streamViewers: number | null;
};

function displayName(p: { display_name: string | null; gamertag: string | null } | null | undefined): string {
  return p?.display_name || p?.gamertag || 'Player';
}

async function fetchSide(fixtureId: string, teamId: string): Promise<FixtureSide> {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, team_members(role, profiles(display_name, gamertag))')
    .eq('id', teamId)
    .single();

  const { data: starters } = await supabase
    .from('fixture_lineups')
    .select('profile_id, profiles(display_name, gamertag)')
    .eq('fixture_id', fixtureId)
    .eq('team_id', teamId);

  const captain = (team?.team_members ?? []).find((m: any) => m.role === 'captain');

  return {
    teamId,
    teamName: team?.name ?? 'Team',
    captainName: displayName(captain?.profiles as any),
    starters: (starters ?? []).map((s) => ({ profileId: s.profile_id, name: displayName(s.profiles as any) })),
  };
}

async function fetchMonitorFixture(fixtureId: string): Promise<MonitorFixture> {
  const { data: fixture, error } = await supabase
    .from('fixtures')
    .select(
      'id, league_id, round_number, best_of, scheduled_at, status, lobby_code, lineup_locked_at, home_team_id, away_team_id, observer_id, observer_stream_live, observer_stream_viewers, leagues(name), observer:profiles!fixtures_observer_id_fkey(display_name, gamertag, twitch_login)',
    )
    .eq('id', fixtureId)
    .single();
  if (error || !fixture) throw error ?? new Error('Fixture not found');

  const [home, away, { data: maps }] = await Promise.all([
    fetchSide(fixtureId, fixture.home_team_id),
    fetchSide(fixtureId, fixture.away_team_id),
    supabase.from('fixture_maps').select('winner_team_id').eq('fixture_id', fixtureId),
  ]);

  return {
    id: fixture.id,
    leagueId: fixture.league_id,
    leagueName: (fixture.leagues as any)?.name ?? 'League',
    roundNumber: fixture.round_number,
    bestOf: fixture.best_of,
    scheduledAt: fixture.scheduled_at,
    status: fixture.status,
    lobbyCode: fixture.lobby_code,
    lineupLockedAt: fixture.lineup_locked_at,
    home,
    away,
    homeMapsWon: (maps ?? []).filter((m) => m.winner_team_id === fixture.home_team_id).length,
    awayMapsWon: (maps ?? []).filter((m) => m.winner_team_id === fixture.away_team_id).length,
    observerId: fixture.observer_id,
    observerName: fixture.observer_id ? displayName(fixture.observer as any) : null,
    observerTwitchLogin: (fixture.observer as any)?.twitch_login ?? null,
    streamLive: fixture.observer_stream_live,
    streamViewers: fixture.observer_stream_viewers,
  };
}

export function useMonitorFixture(fixtureId: string | undefined) {
  return useQuery({
    queryKey: ['adminFixtureMonitor', fixtureId],
    queryFn: () => fetchMonitorFixture(fixtureId as string),
    enabled: !!fixtureId,
    refetchInterval: 15_000,
  });
}

/** Mirrors useAdvanceGamePhase: scheduled → lineup_lock → live. Never sets
 * 'completed' — that only happens from the verify screen once a series
 * score is published. */
export function useAdvanceFixturePhase(fixtureId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nextStatus }: { nextStatus: string }) => {
      const { error } = await supabase
        .from('fixtures')
        .update(nextStatus === 'lineup_lock' ? { status: nextStatus, lineup_locked_at: new Date().toISOString() } : { status: nextStatus })
        .eq('id', fixtureId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtureMonitor', fixtureId] });
      queryClient.invalidateQueries({ queryKey: ['adminFixtures'] });
    },
  });
}

export function useSetMonitorFixtureLobbyCode(fixtureId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lobbyCode: string | null) => {
      const { error } = await supabase.from('fixtures').update({ lobby_code: lobbyCode }).eq('id', fixtureId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtureMonitor', fixtureId] });
      queryClient.invalidateQueries({ queryKey: ['adminFixtures'] });
    },
  });
}
