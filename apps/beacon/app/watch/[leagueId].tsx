import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Logo } from '../../components/Logo';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily, tabularNums, titleColors } from '../../theme/tokens';
import {
  PublicFixtureRow,
  PublicGameRow,
  PublicStandingsRow,
  usePublicLeagueDetail,
  usePublicObserverHandle,
} from '../../lib/api/publicWatch';

// Public, no-session league page — standings + schedule/live results +
// the observer's Twitch link when one's live. Realtime-subscribed (see
// usePublicLeagueDetail) so scores update on every visitor's screen
// without a refresh. Deliberately excludes: lobby codes, player names,
// rosters/lineups, anything tied to a profile beyond the observer's
// public Twitch handle — see the migration this page's API depends on.
export default function PublicWatchLeague() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { data: league, isLoading } = usePublicLeagueDetail(leagueId);

  if (isLoading || !league) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
      </SafeAreaView>
    );
  }

  const accent = titleColors(league.titleName.toLowerCase().includes('valorant') ? 'valorant' : 'apex');
  const liveGames = league.games.filter((g) => g.streamLive);
  const liveFixtures = league.fixtures.filter((f) => f.streamLive);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.push('/watch' as any)} style={styles.navBrand}>
          <Logo size={22} />
          <Text style={styles.wordmark}>BEACON</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/sign-up')}>
          {({ pressed, hovered }: any) => (
            <View style={[styles.signInButton, (pressed || hovered) && { backgroundColor: color.fillHover }]}>
              <Text style={styles.signInLabel}>Sign in</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/watch' as any)}>
            <Text style={styles.back}>← All leagues</Text>
          </Pressable>
          <View style={styles.titleChip}>
            <View style={[styles.titleDot, { backgroundColor: accent.accent }]} />
            <Text style={[styles.titleChipLabel, { color: accent.accent }]}>{league.titleName.toUpperCase()}</Text>
          </View>
          <Text style={styles.leagueName}>{league.name}</Text>
          <Text style={styles.leagueMeta}>
            {league.region}
            {league.seasonLabel ? ` · ${league.seasonLabel}` : ''}
          </Text>
        </View>

        {(liveGames.length > 0 || liveFixtures.length > 0) && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>Live now</Text>
            {liveGames.map((g) => (
              <LiveObserverCard key={g.id} observerId={g.observerId} viewers={g.streamViewers} label={`Match ${g.roundNumber} · Game ${g.gameNumber}`} />
            ))}
            {liveFixtures.map((f) => (
              <LiveObserverCard
                key={f.id}
                observerId={f.observerId}
                viewers={f.streamViewers}
                label={`${f.homeTeamName} vs ${f.awayTeamName}`}
              />
            ))}
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Text style={styles.sectionLabel}>Standings</Text>
          <StandingsTable rows={league.standings} />
        </View>

        {league.games.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>Schedule &amp; results</Text>
            <View style={styles.list}>
              {league.games.map((g) => (
                <GameRow key={g.id} game={g} />
              ))}
            </View>
          </View>
        )}

        {league.fixtures.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>Schedule &amp; results</Text>
            <View style={styles.list}>
              {league.fixtures.map((f) => (
                <FixtureRow key={f.id} fixture={f} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LiveObserverCard({ observerId, viewers, label }: { observerId: string | null; viewers: number | null; label: string }) {
  const { data: handle } = usePublicObserverHandle(observerId);
  if (!handle?.twitch_login) return null;

  return (
    <Pressable onPress={() => Linking.openURL(`https://twitch.tv/${handle.twitch_login}`)}>
      {({ pressed, hovered }: any) => (
        <View style={[styles.liveCard, { backgroundColor: pressed ? color.emberActive : hovered ? color.emberHover : color.ember }]}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text style={styles.liveLabel} numberOfLines={1}>{label}</Text>
            <Text style={styles.liveSub}>{viewers ?? 0} watching on Twitch</Text>
          </View>
          <Text style={styles.liveArrow}>Watch →</Text>
        </View>
      )}
    </Pressable>
  );
}

function StandingsTable({ rows }: { rows: PublicStandingsRow[] }) {
  if (rows.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No standings yet — check back once games have been played.</Text>
      </View>
    );
  }
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { width: 30 }]}>#</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TEAM</Text>
        <Text style={[styles.tableHeaderCell, { width: 150, textAlign: 'right' }]}>DETAIL</Text>
        <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'right' }]}>PTS</Text>
      </View>
      {rows.map((r) => (
        <View key={r.teamId} style={styles.tableRow}>
          <Text style={[styles.rowIndex, tabularNums]}>{String(r.rank).padStart(2, '0')}</Text>
          <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
          <Text style={[styles.rowDetail, tabularNums]}>{r.detail}</Text>
          <Text style={[styles.rowPoints, tabularNums]}>{r.points}</Text>
        </View>
      ))}
    </View>
  );
}

function GameRow({ game }: { game: PublicGameRow }) {
  const completed = game.status === 'completed';
  const live = game.status === 'in_progress' || game.status === 'lobby_open';
  return (
    <View style={styles.matchRow}>
      <View style={styles.matchTopRow}>
        <Text style={styles.matchTitle}>Match {game.roundNumber} · Game {game.gameNumber}</Text>
        <StatusChip status={game.status} />
      </View>
      <Text style={[styles.matchMeta, tabularNums]}>
        {formatWhen(game.scheduledAt)}
        {game.map ? ` · ${game.map}` : ''}
      </Text>
      {completed && game.results.length > 0 && (
        <View style={styles.resultsList}>
          {game.results.slice(0, 3).map((r, i) => (
            <Text key={i} style={styles.resultLine}>
              {i + 1}. {r.teamName} {r.placement ? `· #${r.placement}` : ''} {r.kills != null ? `· ${r.kills} kills` : ''}
            </Text>
          ))}
        </View>
      )}
      {live && <Text style={styles.liveNote}>● Live</Text>}
    </View>
  );
}

function FixtureRow({ fixture }: { fixture: PublicFixtureRow }) {
  const completed = fixture.status === 'completed';
  return (
    <View style={styles.matchRow}>
      <View style={styles.matchTopRow}>
        <Text style={styles.matchTitle}>{fixture.homeTeamName} vs {fixture.awayTeamName}</Text>
        <StatusChip status={fixture.status} />
      </View>
      <Text style={[styles.matchMeta, tabularNums]}>
        {formatWhen(fixture.scheduledAt)} · Bo{fixture.bestOf}
        {completed ? ` · ${fixture.homeScore}–${fixture.awayScore}` : ''}
      </Text>
    </View>
  );
}

function StatusChip({ status }: { status: string }) {
  const live = status === 'in_progress' || status === 'lobby_open' || status === 'live' || status === 'lineup_lock';
  const completed = status === 'completed';
  const label = status.replace('_', ' ').toUpperCase();
  return (
    <View style={[styles.statusChip, live && styles.statusChipLive, completed && styles.statusChipDone]}>
      <Text style={[styles.statusChipLabel, live && { color: color.ember }, completed && { color: color.verified }]}>{label}</Text>
    </View>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingBottom: 0 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 17, letterSpacing: 0.08 * 17, color: color.textPrimary },
  signInButton: { height: 36, paddingHorizontal: 16, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  signInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  scroll: { padding: 22, paddingTop: 18, gap: 24, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: 8 },
  back: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, marginBottom: 4 },
  titleChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleDot: { width: 6, height: 6, borderRadius: 3 },
  titleChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.12 * 10 },
  leagueName: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, letterSpacing: 0.01 * 30, color: color.textPrimary },
  leagueMeta: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, textTransform: 'uppercase', color: color.textMuted },
  liveCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderColor: color.ember },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.base },
  liveLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.base },
  liveSub: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.base, opacity: 0.85 },
  liveArrow: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.base },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 20 },
  emptyText: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted },
  table: { borderWidth: 1, borderColor: color.hairline },
  tableHeaderRow: { flexDirection: 'row', gap: 10, padding: 10, paddingHorizontal: 14, backgroundColor: color.panel, borderBottomWidth: 1, borderBottomColor: color.hairline },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  tableRow: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.06)' },
  rowIndex: { width: 30, fontFamily: fontFamily.rajdhaniBold, fontSize: 13, color: color.textMuted },
  rowName: { flex: 1, fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  rowDetail: { width: 150, textAlign: 'right', fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  rowPoints: { width: 70, textAlign: 'right', fontFamily: fontFamily.rajdhaniBold, fontSize: 18, color: color.textPrimary },
  list: { gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline },
  matchRow: { backgroundColor: color.panel, padding: 16, gap: 8 },
  matchTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  matchTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 16, letterSpacing: 0.01 * 16, color: color.textPrimary, flex: 1, minWidth: 0 },
  matchMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  statusChip: { borderWidth: 1, borderColor: color.hairlineStrong, paddingVertical: 3, paddingHorizontal: 7 },
  statusChipLive: { borderColor: color.emberBorderStrong },
  statusChipDone: { borderColor: color.verifiedTintBorder },
  statusChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.08 * 9, color: color.textMuted },
  resultsList: { gap: 3, borderTopWidth: 1, borderTopColor: 'rgba(242,241,236,0.08)', paddingTop: 8, marginTop: 2 },
  resultLine: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  liveNote: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.ember },
});
