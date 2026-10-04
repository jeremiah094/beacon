import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type UpcomingFixture = {
  id: string;
  roundNumber: number;
  scheduledAt: string;
  lockAt: string;
  bestOf: number;
  lobbyCode: string | null;
  status: string;
  opponentName: string;
  isHome: boolean;
  myMapsWon: number;
  opponentMapsWon: number;
};

export type UpcomingFixturesData = {
  teamName: string;
  leagueName: string | null;
  fixtures: UpcomingFixture[];
};

async function fetchUpcomingFixtures(teamId: string): Promise<UpcomingFixturesData> {
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();

  const { data: leagueTeam } = await supabase
    .from('league_teams')
    .select('league_id, leagues(name)')
    .eq('team_id', teamId)
    .eq('status', 'approved')
    .maybeSingle();

  if (!leagueTeam) {
    return { teamName: team?.name ?? 'Team', leagueName: null, fixtures: [] };
  }

  // Same window as useUpcomingGames: upcoming + live (by wall-clock) +
  // completed within the last day — older results belong on standings.
  const windowStart = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(
      'id, round_number, scheduled_at, best_of, lobby_code, status, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)',
    )
    .eq('league_id', leagueTeam.league_id)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .neq('status', 'cancelled')
    .gte('scheduled_at', windowStart)
    .order('scheduled_at', { ascending: true });

  const fixtureIds = (fixtures ?? []).map((f) => f.id);
  const { data: maps } = fixtureIds.length
    ? await supabase.from('fixture_maps').select('fixture_id, winner_team_id').in('fixture_id', fixtureIds)
    : { data: [] as { fixture_id: string; winner_team_id: string | null }[] };

  return {
    teamName: team?.name ?? 'Team',
    leagueName: (leagueTeam.leagues as any)?.name ?? null,
    fixtures: (fixtures ?? []).map((f) => {
      const isHome = f.home_team_id === teamId;
      const opponentName = (isHome ? (f.away_team as any)?.name : (f.home_team as any)?.name) ?? 'Opponent';
      const fixtureMaps = (maps ?? []).filter((m) => m.fixture_id === f.id);
      const myMapsWon = fixtureMaps.filter((m) => m.winner_team_id === teamId).length;
      const opponentMapsWon = fixtureMaps.filter((m) => m.winner_team_id && m.winner_team_id !== teamId).length;
      return {
        id: f.id,
        roundNumber: f.round_number,
        scheduledAt: f.scheduled_at,
        lockAt: new Date(new Date(f.scheduled_at).getTime() - 10 * 60_000).toISOString(),
        bestOf: f.best_of,
        lobbyCode: f.lobby_code,
        status: f.status,
        opponentName,
        isHome,
        myMapsWon,
        opponentMapsWon,
      };
    }),
  };
}

export function useUpcomingFixtures(teamId: string | undefined) {
  return useQuery({
    queryKey: ['upcomingFixtures', teamId],
    queryFn: () => fetchUpcomingFixtures(teamId as string),
    enabled: !!teamId,
  });
}

export type FixtureRosterPlayer = {
  profileId: string;
  name: string;
  initials: string;
  role: string;
  meta: string;
  verified: boolean;
  eligible: boolean;
};

export type FixtureLineupData = {
  teamId: string;
  teamName: string;
  leagueName: string | null;
  roster: FixtureRosterPlayer[];
  fixtureId: string | null;
  opponentName: string | null;
  roundNumber: number | null;
  bestOf: number | null;
  scheduledAt: string | null;
  lockAt: string | null;
  isLocked: boolean;
  selectedProfileIds: string[];
};

function personMeta(row: { rank_name: string | null; kd: number | null; verifiedAt: string | null }) {
  if (!row.verifiedAt) return 'Awaiting Riot link';
  const rank = row.rank_name ?? 'Unranked';
  const kd = row.kd != null ? `${row.kd.toFixed(2)} K/D` : '';
  return kd ? `${rank} · ${kd}` : rank;
}

/** Fixture equivalent of fetchTeamLineup — finds the team's next
 * scheduled/lineup_lock fixture and the 5 starters set for it via
 * fixture_lineups, which (unlike Apex's lineups table) has no row of its
 * own: it's just a set of (fixture_id, team_id, profile_id) rows, so
 * "selected" is simply membership, with no separate confirm step. */
async function fetchFixtureLineup(teamId: string): Promise<FixtureLineupData> {
  const { data: team } = await supabase.from('teams').select('id, name, title_id').eq('id', teamId).single();

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('profile_id, role, profiles(gamertag)')
    .eq('team_id', teamId);
  if (membersError) throw membersError;

  const profileIds = (members ?? []).map((m) => m.profile_id);
  const { data: accounts } = team?.title_id
    ? await supabase.from('game_accounts').select('profile_id, verified_at, rank_name, kd').eq('title_id', team.title_id).in('profile_id', profileIds)
    : { data: [] };
  const accountByProfile = new Map((accounts ?? []).map((a) => [a.profile_id, a]));

  const roster: FixtureRosterPlayer[] = (members ?? []).map((m) => {
    const profile = m.profiles as any;
    const account = accountByProfile.get(m.profile_id);
    const verified = !!account?.verified_at;
    return {
      profileId: m.profile_id,
      name: profile?.gamertag ?? 'Player',
      initials: (profile?.gamertag ?? '??').slice(0, 2).toUpperCase(),
      role: m.role,
      meta: personMeta({ rank_name: account?.rank_name ?? null, kd: account?.kd ?? null, verifiedAt: account?.verified_at ?? null }),
      verified,
      eligible: verified,
    };
  });

  const { data: leagueTeam } = await supabase
    .from('league_teams')
    .select('league_id, leagues(name)')
    .eq('team_id', teamId)
    .eq('status', 'approved')
    .maybeSingle();

  let fixtureId: string | null = null;
  let opponentName: string | null = null;
  let roundNumber: number | null = null;
  let bestOf: number | null = null;
  let scheduledAt: string | null = null;
  let lineupLockedAt: string | null = null;
  let selectedProfileIds: string[] = [];

  if (leagueTeam) {
    const { data: fixture } = await supabase
      .from('fixtures')
      .select(
        'id, round_number, best_of, scheduled_at, lineup_locked_at, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)',
      )
      .eq('league_id', leagueTeam.league_id)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in('status', ['scheduled', 'lineup_lock'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fixture) {
      fixtureId = fixture.id;
      roundNumber = fixture.round_number;
      bestOf = fixture.best_of;
      scheduledAt = fixture.scheduled_at;
      lineupLockedAt = fixture.lineup_locked_at;
      opponentName = (fixture.home_team_id === teamId ? (fixture.away_team as any)?.name : (fixture.home_team as any)?.name) ?? 'Opponent';

      const { data: picks } = await supabase.from('fixture_lineups').select('profile_id').eq('fixture_id', fixture.id).eq('team_id', teamId);
      selectedProfileIds = (picks ?? []).map((p) => p.profile_id);
    }
  }

  const isLocked = !!lineupLockedAt || (!!scheduledAt && Date.now() >= new Date(scheduledAt).getTime() - 10 * 60_000);
  const lockAt = scheduledAt ? new Date(new Date(scheduledAt).getTime() - 10 * 60_000).toISOString() : null;

  return {
    teamId,
    teamName: team?.name ?? 'Team',
    leagueName: (leagueTeam?.leagues as any)?.name ?? null,
    roster,
    fixtureId,
    opponentName,
    roundNumber,
    bestOf,
    scheduledAt,
    lockAt,
    isLocked,
    selectedProfileIds,
  };
}

export function useFixtureLineup(teamId: string | undefined) {
  return useQuery({
    queryKey: ['fixtureLineup', teamId],
    queryFn: () => fetchFixtureLineup(teamId as string),
    enabled: !!teamId,
    refetchInterval: 30_000,
  });
}

/** Replaces the fixture_lineups rows for (fixtureId, teamId) — RLS
 * (fixture_lineups_captain_write) blocks this once the fixture's
 * lineup_locked_at is set; this is a convenience wrapper, not the
 * enforcement. */
export function useSetFixtureLineup(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fixtureId, profileIds }: { fixtureId: string; profileIds: string[] }) => {
      const { error: deleteError } = await supabase.from('fixture_lineups').delete().eq('fixture_id', fixtureId).eq('team_id', teamId);
      if (deleteError) throw deleteError;

      if (profileIds.length > 0) {
        const { error: insertError } = await supabase
          .from('fixture_lineups')
          .insert(profileIds.map((profileId) => ({ fixture_id: fixtureId, team_id: teamId, profile_id: profileId })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtureLineup', teamId] });
      queryClient.invalidateQueries({ queryKey: ['fixtureLobby'] });
    },
  });
}

export type FixtureMapScore = { mapNumber: number; mapName: string | null; homeScore: number | null; awayScore: number | null; winnerTeamId: string | null };

export type FixtureLobbyData = {
  fixtureId: string;
  leagueName: string | null;
  roundNumber: number;
  bestOf: number;
  scheduledAt: string;
  status: string;
  lobbyCode: string | null;
  lineupLockedAt: string | null;
  myTeamName: string;
  opponentName: string;
  myMapsWon: number;
  opponentMapsWon: number;
  maps: FixtureMapScore[];
  myStarters: { profileId: string; name: string; initials: string }[];
  streamLive: boolean;
  streamViewers: number | null;
  observerTwitchLogin: string | null;
};

async function fetchFixtureLobby(fixtureId: string, teamId: string): Promise<FixtureLobbyData> {
  const { data: fixture } = await supabase
    .from('fixtures')
    .select(
      'id, round_number, best_of, scheduled_at, status, lobby_code, lineup_locked_at, home_team_id, away_team_id, observer_stream_live, observer_stream_viewers, leagues(name), home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), observer:profiles!fixtures_observer_id_fkey(twitch_login)',
    )
    .eq('id', fixtureId)
    .single();

  const isHome = fixture?.home_team_id === teamId;
  const myTeamName = ((isHome ? fixture?.home_team : fixture?.away_team) as any)?.name ?? 'Your team';
  const opponentName = ((isHome ? fixture?.away_team : fixture?.home_team) as any)?.name ?? 'Opponent';

  const { data: maps } = await supabase
    .from('fixture_maps')
    .select('map_number, map_name, home_score, away_score, winner_team_id')
    .eq('fixture_id', fixtureId)
    .order('map_number');

  const myMapsWon = (maps ?? []).filter((m) => m.winner_team_id === teamId).length;
  const opponentMapsWon = (maps ?? []).filter((m) => m.winner_team_id && m.winner_team_id !== teamId).length;

  const { data: starters } = await supabase
    .from('fixture_lineups')
    .select('profile_id, profiles(gamertag)')
    .eq('fixture_id', fixtureId)
    .eq('team_id', teamId);

  return {
    fixtureId,
    leagueName: (fixture?.leagues as any)?.name ?? null,
    roundNumber: fixture?.round_number ?? 0,
    bestOf: fixture?.best_of ?? 3,
    scheduledAt: fixture?.scheduled_at ?? new Date().toISOString(),
    status: fixture?.status ?? 'scheduled',
    lobbyCode: fixture?.lobby_code ?? null,
    lineupLockedAt: fixture?.lineup_locked_at ?? null,
    myTeamName,
    opponentName,
    myMapsWon,
    opponentMapsWon,
    maps: (maps ?? []).map((m) => ({ mapNumber: m.map_number, mapName: m.map_name, homeScore: m.home_score, awayScore: m.away_score, winnerTeamId: m.winner_team_id })),
    myStarters: (starters ?? []).map((s) => {
      const name = (s.profiles as any)?.gamertag ?? 'Player';
      return { profileId: s.profile_id, name, initials: name.slice(0, 2).toUpperCase() };
    }),
    streamLive: fixture?.observer_stream_live ?? false,
    streamViewers: fixture?.observer_stream_viewers ?? null,
    observerTwitchLogin: (fixture?.observer as any)?.twitch_login ?? null,
  };
}

/** Resolves which of the signed-in player's teams a fixture belongs to —
 * same cold-start requirement as useResolveTeamForGame (a push can deep
 * link here with no prior navigation context). */
export function useResolveTeamForFixture(fixtureId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['resolveTeamForFixture', fixtureId, userId],
    queryFn: async () => {
      const { data: fixture } = await supabase.from('fixtures').select('home_team_id, away_team_id').eq('id', fixtureId as string).single();
      if (!fixture) return undefined;
      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('profile_id', userId as string);
      const teamIds = (memberships ?? []).map((m) => m.team_id);
      return teamIds.find((id) => id === fixture.home_team_id || id === fixture.away_team_id);
    },
    enabled: !!fixtureId && !!userId,
  });
}

/** Live fixture state — subscribes to Realtime on fixtures/fixture_maps so
 * the score, lobby code and status update without a refresh. */
export function useFixtureLobby(fixtureId: string | undefined, teamId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['fixtureLobby', fixtureId, teamId];

  useEffect(() => {
    if (!fixtureId || !teamId) return;
    const channel = supabase
      .channel(`fixture-lobby-${fixtureId}-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures', filter: `id=eq.${fixtureId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixture_maps', filter: `fixture_id=eq.${fixtureId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fixtureId, teamId, queryClient]);

  return useQuery({
    queryKey,
    queryFn: () => fetchFixtureLobby(fixtureId as string, teamId as string),
    enabled: !!fixtureId && !!teamId,
  });
}
