import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Everything in this file is read by signed-out visitors on /watch — the
// public, no-session league/standings/live-results pages. The contract:
// team names and scores, yes; lobby codes, player identities, and
// anything else tied to a profile, no. That boundary is enforced at the
// database layer (see 20261005092248_public_watch_pages.sql — RLS +
// column-level grants scoped to the anon role), not just by what these
// queries choose to select — the anon API key is public in the client
// bundle regardless, so the real guarantee has to live in Postgres.

export type PublicLeagueSummary = {
  id: string;
  name: string;
  titleName: string;
  titleSlug: string;
  seasonLabel: string | null;
  region: string;
  formatType: 'battle_royale' | 'head_to_head';
  registeredTeams: number;
};

async function fetchPublicLeagues(): Promise<PublicLeagueSummary[]> {
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, season_label, region, titles(name, slug, format_type)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (!leagues || leagues.length === 0) return [];

  const { data: regs } = await supabase
    .from('league_teams')
    .select('league_id')
    .in('league_id', leagues.map((l) => l.id))
    .eq('status', 'approved');

  const counts = new Map<string, number>();
  for (const r of regs ?? []) counts.set(r.league_id, (counts.get(r.league_id) ?? 0) + 1);

  return leagues.map((l) => ({
    id: l.id,
    name: l.name,
    titleName: (l.titles as any)?.name ?? 'Beacon',
    titleSlug: (l.titles as any)?.slug ?? 'apex',
    formatType: ((l.titles as any)?.format_type as 'battle_royale' | 'head_to_head') ?? 'battle_royale',
    seasonLabel: l.season_label,
    region: l.region,
    registeredTeams: counts.get(l.id) ?? 0,
  }));
}

export function usePublicLeagues() {
  return useQuery({ queryKey: ['publicLeagues'], queryFn: fetchPublicLeagues });
}

export type PublicStandingsRow = { rank: number; teamId: string; name: string; points: number; detail: string };

async function fetchPublicStandings(leagueId: string, formatType: 'battle_royale' | 'head_to_head'): Promise<PublicStandingsRow[]> {
  const { data: approvedTeams } = await supabase
    .from('league_teams')
    .select('team_id, teams(name)')
    .eq('league_id', leagueId)
    .eq('status', 'approved');

  if (formatType === 'head_to_head') {
    const { data } = await supabase
      .from('h2h_standings')
      .select('team_id, series_won, series_lost, total_points, teams(name)')
      .eq('league_id', leagueId);
    const seen = new Set((data ?? []).map((r) => r.team_id));
    const zero = (approvedTeams ?? [])
      .filter((t) => !seen.has(t.team_id))
      .map((t) => ({ team_id: t.team_id, series_won: 0, series_lost: 0, total_points: 0, teams: t.teams }));
    return [...(data ?? []), ...zero]
      .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0))
      .map((r, i) => ({
        rank: i + 1,
        teamId: r.team_id as string,
        name: (r.teams as any)?.name ?? 'Team',
        points: r.total_points ?? 0,
        detail: `${r.series_won}–${r.series_lost} series`,
      }));
  }

  const { data } = await supabase
    .from('standings')
    .select('team_id, total_kills, total_points, games_played, teams(name)')
    .eq('league_id', leagueId);
  const seen = new Set((data ?? []).map((r) => r.team_id));
  const zero = (approvedTeams ?? [])
    .filter((t) => !seen.has(t.team_id))
    .map((t) => ({ team_id: t.team_id, total_kills: 0, total_points: 0, games_played: 0, teams: t.teams }));
  return [...(data ?? []), ...zero]
    .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0))
    .map((r, i) => ({
      rank: i + 1,
      teamId: r.team_id as string,
      name: (r.teams as any)?.name ?? 'Team',
      points: r.total_points ?? 0,
      detail: `${r.games_played} played · ${r.total_kills} kills`,
    }));
}

export type PublicGameResult = { teamName: string; placement: number | null; kills: number | null };
export type PublicGameRow = {
  id: string;
  roundNumber: number;
  gameNumber: number;
  scheduledAt: string;
  map: string | null;
  status: string;
  observerId: string | null;
  streamLive: boolean;
  streamViewers: number | null;
  results: PublicGameResult[];
};

async function fetchPublicGames(leagueId: string): Promise<PublicGameRow[]> {
  const { data: games } = await supabase
    .from('games')
    .select('id, round_number, game_number, scheduled_at, map, status, observer_id, observer_stream_live, observer_stream_viewers')
    .eq('league_id', leagueId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });
  if (!games?.length) return [];

  const { data: results } = await supabase
    .from('results')
    .select('game_id, placement, kills, teams(name)')
    .in('game_id', games.map((g) => g.id))
    .order('placement', { ascending: true });

  return games.map((g) => ({
    id: g.id,
    roundNumber: g.round_number,
    gameNumber: g.game_number,
    scheduledAt: g.scheduled_at,
    map: g.map,
    status: g.status,
    observerId: g.observer_id,
    streamLive: g.observer_stream_live,
    streamViewers: g.observer_stream_viewers,
    results: (results ?? [])
      .filter((r) => r.game_id === g.id)
      .map((r) => ({ teamName: (r.teams as any)?.name ?? 'Team', placement: r.placement, kills: r.kills })),
  }));
}

export type PublicFixtureRow = {
  id: string;
  roundNumber: number;
  scheduledAt: string;
  bestOf: number;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  observerId: string | null;
  streamLive: boolean;
  streamViewers: number | null;
};

async function fetchPublicFixtures(leagueId: string): Promise<PublicFixtureRow[]> {
  const { data } = await supabase
    .from('fixtures')
    .select(
      'id, round_number, scheduled_at, best_of, status, home_score, away_score, observer_id, observer_stream_live, observer_stream_viewers, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)',
    )
    .eq('league_id', leagueId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });

  return (data ?? []).map((f) => ({
    id: f.id,
    roundNumber: f.round_number,
    scheduledAt: f.scheduled_at,
    bestOf: f.best_of,
    status: f.status,
    homeTeamName: (f.home_team as any)?.name ?? 'Team',
    awayTeamName: (f.away_team as any)?.name ?? 'Team',
    homeScore: f.home_score,
    awayScore: f.away_score,
    observerId: f.observer_id,
    streamLive: f.observer_stream_live,
    streamViewers: f.observer_stream_viewers,
  }));
}

export type PublicLeagueDetail = {
  id: string;
  name: string;
  seasonLabel: string | null;
  region: string;
  titleName: string;
  formatType: 'battle_royale' | 'head_to_head';
  standings: PublicStandingsRow[];
  games: PublicGameRow[];
  fixtures: PublicFixtureRow[];
};

async function fetchPublicLeagueDetail(leagueId: string): Promise<PublicLeagueDetail | null> {
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, season_label, region, titles(name, format_type)')
    .eq('id', leagueId)
    .single();
  if (!league) return null;

  const formatType = ((league.titles as any)?.format_type as 'battle_royale' | 'head_to_head') ?? 'battle_royale';
  const [standings, games, fixtures] = await Promise.all([
    fetchPublicStandings(leagueId, formatType),
    formatType === 'battle_royale' ? fetchPublicGames(leagueId) : Promise.resolve([]),
    formatType === 'head_to_head' ? fetchPublicFixtures(leagueId) : Promise.resolve([]),
  ]);

  return {
    id: league.id,
    name: league.name,
    seasonLabel: league.season_label,
    region: league.region,
    titleName: (league.titles as any)?.name ?? 'Beacon',
    formatType,
    standings,
    games,
    fixtures,
  };
}

/** Live: subscribes to Realtime on games/fixtures/results/fixture_maps for
 * this league so standings and live scores update on every visitor's
 * screen without a refresh — the same mechanism the signed-in match lobby
 * screens use, just scoped to a league instead of a single row. */
export function usePublicLeagueDetail(leagueId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['publicLeagueDetail', leagueId];

  useEffect(() => {
    if (!leagueId) return;
    const channel = supabase
      .channel(`public-watch-${leagueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `league_id=eq.${leagueId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures', filter: `league_id=eq.${leagueId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixture_maps' }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, queryClient]);

  return useQuery({
    queryKey,
    queryFn: () => fetchPublicLeagueDetail(leagueId as string),
    enabled: !!leagueId,
  });
}

/** The one piece of profile data a spectator needs — resolved through a
 * narrow RPC rather than any direct profiles access (see migration). */
export function usePublicObserverHandle(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['publicObserverHandle', profileId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_observer_handle', { p_profile_id: profileId as string });
      if (error) throw error;
      return (data?.[0] as { display_name: string | null; twitch_login: string | null } | undefined) ?? null;
    },
    enabled: !!profileId,
  });
}
