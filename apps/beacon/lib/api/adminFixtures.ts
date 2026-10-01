import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type ApprovedTeam = { id: string; name: string };

async function fetchApprovedTeams(leagueId: string): Promise<ApprovedTeam[]> {
  const { data } = await supabase
    .from('league_teams')
    .select('team_id, teams(id, name)')
    .eq('league_id', leagueId)
    .eq('status', 'approved');
  return (data ?? [])
    .map((r) => r.teams as any)
    .filter(Boolean)
    .map((t) => ({ id: t.id as string, name: t.name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useApprovedTeams(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['approvedTeams', leagueId],
    queryFn: () => fetchApprovedTeams(leagueId as string),
    enabled: !!leagueId,
  });
}

export type AdminFixture = {
  id: string;
  roundNumber: number;
  scheduledAt: string;
  bestOf: number;
  status: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  lobbyCode: string | null;
  observerId: string | null;
  observerName: string | null;
  observerTwitchLogin: string | null;
  streamLive: boolean;
  streamViewers: number | null;
};

async function fetchAdminFixtures(leagueId: string): Promise<AdminFixture[]> {
  const { data } = await supabase
    .from('fixtures')
    .select(
      'id, round_number, scheduled_at, best_of, status, home_score, away_score, winner_team_id, lobby_code, observer_id, observer_stream_live, observer_stream_viewers, home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name), observer:profiles!fixtures_observer_id_fkey(display_name, gamertag, twitch_login)',
    )
    .eq('league_id', leagueId)
    .order('round_number', { ascending: true })
    .order('scheduled_at', { ascending: true });

  return (data ?? []).map((f) => ({
    id: f.id,
    roundNumber: f.round_number,
    scheduledAt: f.scheduled_at,
    bestOf: f.best_of,
    status: f.status,
    homeTeamId: (f.home_team as any)?.id,
    homeTeamName: (f.home_team as any)?.name ?? 'Team',
    awayTeamId: (f.away_team as any)?.id,
    awayTeamName: (f.away_team as any)?.name ?? 'Team',
    homeScore: f.home_score,
    awayScore: f.away_score,
    winnerTeamId: f.winner_team_id,
    lobbyCode: f.lobby_code,
    observerId: f.observer_id,
    observerName: f.observer_id ? ((f.observer as any)?.display_name ?? (f.observer as any)?.gamertag ?? 'Admin') : null,
    observerTwitchLogin: (f.observer as any)?.twitch_login ?? null,
    streamLive: f.observer_stream_live,
    streamViewers: f.observer_stream_viewers,
  }));
}

export function useAdminFixtures(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['adminFixtures', leagueId],
    queryFn: () => fetchAdminFixtures(leagueId as string),
    enabled: !!leagueId,
  });
}

export function useSetFixtureObserver(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fixtureId, observerId }: { fixtureId: string; observerId: string | null }) => {
      const { error } = await supabase.from('fixtures').update({ observer_id: observerId }).eq('id', fixtureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
    },
  });
}

export function useSetFixtureLobbyCode(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fixtureId, lobbyCode }: { fixtureId: string; lobbyCode: string | null }) => {
      const { error } = await supabase.from('fixtures').update({ lobby_code: lobbyCode }).eq('id', fixtureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
    },
  });
}

/** Standard "circle method" round-robin: fixes one team and rotates the
 * rest around it for teamCount-1 rounds, so every team plays every other
 * team exactly once with no team idle twice and none double-booked in a
 * round. An odd team count gets a bye slot that's dropped from the output.
 * Home/away alternates by round parity for a rough balance. */
function circleMethodRounds(teamIds: string[]): { home: string; away: string }[][] {
  const BYE = '__bye__';
  const arr = [...teamIds];
  if (arr.length % 2 !== 0) arr.push(BYE);
  const n = arr.length;
  const rounds: { home: string; away: string }[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== BYE && b !== BYE) {
        pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
    }
    rounds.push(pairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

/** Generates the full round robin for a league from its approved teams —
 * refuses if any fixtures already exist (regenerating on top of live
 * results/edits isn't supported; delete the league's fixtures first, or
 * add teams before generating). Defaults every fixture to Bo3 and a
 * placeholder time (season start, one week per round) — both are editable
 * per fixture afterward from the Schedule screen, same as Apex's flow. */
export function useGenerateRoundRobin(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!leagueId) throw new Error('No league selected.');

      const { count: existingCount } = await supabase
        .from('fixtures')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', leagueId);
      if (existingCount && existingCount > 0) {
        throw new Error('Fixtures already exist for this league — delete them first to regenerate the round robin.');
      }

      const [{ data: league }, teams] = await Promise.all([
        supabase.from('leagues').select('games_per_opponent, season_start').eq('id', leagueId).single(),
        fetchApprovedTeams(leagueId),
      ]);
      if (teams.length < 2) throw new Error('At least 2 approved teams are needed to generate a round robin.');

      const legs = (league?.games_per_opponent as 1 | 2 | null) ?? 1;
      let rounds = circleMethodRounds(teams.map((t) => t.id));
      if (legs === 2) {
        rounds = [...rounds, ...rounds.map((round) => round.map((p) => ({ home: p.away, away: p.home })))];
      }

      const seasonStart = league?.season_start ? new Date(league.season_start) : new Date();
      const rows = rounds.flatMap((pairs, roundIdx) => {
        const scheduledAt = new Date(seasonStart);
        scheduledAt.setDate(scheduledAt.getDate() + roundIdx * 7);
        scheduledAt.setHours(20, 0, 0, 0);
        return pairs.map((p) => ({
          league_id: leagueId,
          round_number: roundIdx + 1,
          scheduled_at: scheduledAt.toISOString(),
          best_of: 3,
          home_team_id: p.home,
          away_team_id: p.away,
          status: 'scheduled',
        }));
      });

      const { error } = await supabase.from('fixtures').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

export function useSaveFixture(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fixtureId, scheduledAt, bestOf }: { fixtureId: string; scheduledAt: string; bestOf: number }) => {
      const { error } = await supabase.from('fixtures').update({ scheduled_at: scheduledAt, best_of: bestOf }).eq('id', fixtureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
    },
  });
}

export function useCancelFixture(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fixtureId: string) => {
      const { error } = await supabase.from('fixtures').update({ status: 'cancelled' }).eq('id', fixtureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

/** Deletes every fixture in a league — the escape hatch for "regenerate
 * the round robin" since useGenerateRoundRobin refuses to run over
 * existing fixtures. */
export function useDeleteAllFixtures(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!leagueId) throw new Error('No league selected.');
      const { error } = await supabase.from('fixtures').delete().eq('league_id', leagueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

export type FixtureMapRow = { mapNumber: number; mapName: string; homeScore: string; awayScore: string };

export type FixtureDetail = {
  id: string;
  leagueId: string;
  leagueName: string;
  roundNumber: number;
  scheduledAt: string;
  bestOf: number;
  status: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  maps: { mapNumber: number; mapName: string | null; homeScore: number | null; awayScore: number | null }[];
};

async function fetchFixtureDetail(fixtureId: string): Promise<FixtureDetail | null> {
  const { data: f } = await supabase
    .from('fixtures')
    .select(
      'id, league_id, round_number, scheduled_at, best_of, status, leagues(name), home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name)',
    )
    .eq('id', fixtureId)
    .single();
  if (!f) return null;

  const { data: maps } = await supabase.from('fixture_maps').select('map_number, map_name, home_score, away_score').eq('fixture_id', fixtureId).order('map_number');

  return {
    id: f.id,
    leagueId: f.league_id,
    leagueName: (f.leagues as any)?.name ?? 'League',
    roundNumber: f.round_number,
    scheduledAt: f.scheduled_at,
    bestOf: f.best_of,
    status: f.status,
    homeTeamId: (f.home_team as any)?.id,
    homeTeamName: (f.home_team as any)?.name ?? 'Team',
    awayTeamId: (f.away_team as any)?.id,
    awayTeamName: (f.away_team as any)?.name ?? 'Team',
    maps: (maps ?? []).map((m) => ({ mapNumber: m.map_number, mapName: m.map_name, homeScore: m.home_score, awayScore: m.away_score })),
  };
}

export function useFixtureDetail(fixtureId: string | undefined) {
  return useQuery({
    queryKey: ['fixtureDetail', fixtureId],
    queryFn: () => fetchFixtureDetail(fixtureId as string),
    enabled: !!fixtureId,
  });
}

/** Replaces every map row for a fixture and, when the entered maps give one
 * side a clear majority (more maps won than the other, at least one map
 * filled in), marks the fixture completed with the series score and
 * winner — same "publish" semantics as Apex's verify-results screen, just
 * computed from map wins instead of placement+kills. */
export function useSaveFixtureMaps(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fixtureId,
      homeTeamId,
      awayTeamId,
      maps,
    }: {
      fixtureId: string;
      homeTeamId: string;
      awayTeamId: string;
      maps: { mapNumber: number; mapName: string; homeScore: number; awayScore: number }[];
    }) => {
      if (maps.length === 0) throw new Error('Enter at least one map score before publishing.');
      const tied = maps.filter((m) => m.homeScore === m.awayScore);
      if (tied.length > 0) throw new Error(`Map ${tied[0].mapNumber} is tied — every map needs a winner.`);

      const homeWins = maps.filter((m) => m.homeScore > m.awayScore).length;
      const awayWins = maps.length - homeWins;
      if (homeWins === awayWins) throw new Error('The series is tied — add or correct a map so one side has more wins.');

      const { error: deleteError } = await supabase.from('fixture_maps').delete().eq('fixture_id', fixtureId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('fixture_maps').insert(
        maps.map((m) => ({
          fixture_id: fixtureId,
          map_number: m.mapNumber,
          map_name: m.mapName || null,
          home_score: m.homeScore,
          away_score: m.awayScore,
          winner_team_id: m.homeScore > m.awayScore ? homeTeamId : awayTeamId,
        })),
      );
      if (insertError) throw insertError;

      const { error: fixtureError } = await supabase
        .from('fixtures')
        .update({
          status: 'completed',
          home_score: homeWins,
          away_score: awayWins,
          winner_team_id: homeWins > awayWins ? homeTeamId : awayTeamId,
        })
        .eq('id', fixtureId);
      if (fixtureError) throw fixtureError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fixtureDetail', vars.fixtureId] });
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] });
    },
  });
}

/** Reopens a completed fixture for correction — clears its result back to
 * scheduled without touching the map rows, mirroring Apex's "reopen for
 * correction" (which stays locked/published rather than deleted). */
export function useReopenFixture(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fixtureId: string) => {
      const { error } = await supabase
        .from('fixtures')
        .update({ status: 'scheduled', home_score: null, away_score: null, winner_team_id: null })
        .eq('id', fixtureId);
      if (error) throw error;
    },
    onSuccess: (_data, fixtureId) => {
      queryClient.invalidateQueries({ queryKey: ['fixtureDetail', fixtureId] });
      queryClient.invalidateQueries({ queryKey: ['adminFixtures', leagueId] });
    },
  });
}
