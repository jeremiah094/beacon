import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ClipboardAPI from 'expo-clipboard';
import { BottomNav } from '../../../components/BottomNav';
import { CornerCut } from '../../../components/CornerCut';
import { Diamond } from '../../../components/Diamond';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../theme/tokens';
import { useCountdownLabel } from '../../../lib/hooks/useCountdown';
import { getGamePhase } from '../../../lib/time';
import { useSession } from '../../../lib/hooks/useSession';
import { useActiveTeam } from '../../../lib/hooks/useActiveTeam';
import { useActiveTitle } from '../../../lib/hooks/useActiveTitle';
import { useMyTeams } from '../../../lib/api/teams';
import { useTitleId } from '../../../lib/api/titles';
import { UpcomingFixture, useUpcomingFixtures } from '../../../lib/api/fixturesPlayer';

// Head-to-head equivalent of games/index.tsx — one series (fixture)
// against one opponent per row instead of "20 teams · one lobby". No mute
// toggle here: notification_prefs is keyed to games only (fixture-level
// push isn't built yet — task "Notifications for fixture events").
export default function UpcomingFixtures() {
  const { userId } = useSession();
  const { activeTitleSlug } = useActiveTitle();
  const { data: activeTitleId } = useTitleId(activeTitleSlug ?? 'valorant');
  const { data: myTeams } = useMyTeams(userId, activeTitleId ?? undefined);
  const { activeTeamId } = useActiveTeam((myTeams ?? []).map((t) => t.id));
  const { data, isLoading } = useUpcomingFixtures(activeTeamId ?? undefined);

  const activeTeam = myTeams?.find((t) => t.id === activeTeamId);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
        <BottomNav active="games" />
      </SafeAreaView>
    );
  }

  const phased = data.fixtures.map((f) => ({ ...f, phase: getGamePhase(f.scheduledAt, f.status === 'completed' ? 'completed' : 'scheduled', now) }));
  const liveFixtures = phased.filter((f) => f.phase === 'live' || f.status === 'live');
  const upcoming = phased.filter((f) => f.phase === 'upcoming' && f.status !== 'live');
  const completedFixtures = phased.filter((f) => f.phase === 'completed' || f.status === 'completed').slice().reverse();
  const [nextFixture, ...laterFixtures] = upcoming;
  const seriesLeft = liveFixtures.length + upcoming.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>UPCOMING FIXTURES</Text>
        </View>
        <Text style={styles.subtitle}>
          {data.teamName}
          {data.leagueName ? ` · ${data.leagueName}` : ''} · {seriesLeft} series left
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {liveFixtures.map((f) => (
          <LiveFixtureCard key={f.id} fixture={f} />
        ))}

        {nextFixture ? (
          <NextFixtureCard fixture={nextFixture} teamId={activeTeamId!} />
        ) : liveFixtures.length === 0 && completedFixtures.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No fixtures scheduled yet.</Text>
          </View>
        ) : null}

        {laterFixtures.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Later this season</Text>
            {laterFixtures.map((f) => (
              <LaterFixtureRow key={f.id} fixture={f} />
            ))}
          </>
        )}

        {completedFixtures.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recently completed</Text>
            {completedFixtures.map((f) => (
              <CompletedFixtureRow key={f.id} fixture={f} />
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        <Pressable
          onPress={() => activeTeam?.leagueId && router.push(`/(player)/leagues/${activeTeam.leagueId}/standings` as any)}
          disabled={!activeTeam?.leagueId}
        >
          {({ pressed, hovered }: any) => (
            <View
              style={[
                styles.standingsButton,
                !activeTeam?.leagueId && { opacity: 0.5 },
                !!activeTeam?.leagueId && (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted },
              ]}
            >
              <Text style={styles.standingsLabel}>League standings</Text>
              <Text style={styles.standingsMeta}>{activeTeam?.leagueId ? '→' : 'Not in a league yet'}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <BottomNav active="games" />
    </SafeAreaView>
  );
}

function NextFixtureCard({ fixture, teamId }: { fixture: UpcomingFixture; teamId: string }) {
  const countdown = useCountdownLabel(fixture.lockAt) ?? '0h 00m 00s';
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    if (!fixture.lobbyCode) return;
    await ClipboardAPI.setStringAsync(fixture.lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  }

  return (
    <CornerCut cut={20} fill={color.panel} strokeColor={color.emberBorderSoft} style={{ width: '100%' }}>
      <View style={styles.nextCardContent}>
        <View style={styles.nextCardTopRow}>
          <View style={{ gap: 6 }}>
            <View style={styles.nextChip}>
              <View style={styles.nextChipDot} />
              <Text style={styles.nextChipLabel}>NEXT SERIES</Text>
            </View>
            <Text style={styles.nextTitle}>vs {fixture.opponentName}</Text>
          </View>
        </View>

        <View style={styles.countdownRow}>
          <Text style={[styles.countdownValue, tabularNums]}>{countdown}</Text>
          <Text style={styles.countdownCaption}>until lineups lock</Text>
        </View>

        {fixture.lobbyCode ? (
          <Pressable onPress={handleCopyCode}>
            {({ pressed, hovered }: any) => (
              <View
                style={[
                  styles.lobbyCodeBox,
                  copied
                    ? { backgroundColor: color.verifiedTint, borderColor: color.verifiedTintBorder }
                    : { backgroundColor: pressed ? color.emberActive : hovered ? color.emberHover : color.ember, borderColor: color.ember },
                ]}
              >
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text style={[styles.lobbyCodeLabel, { color: copied ? color.verified : color.base }]}>
                    {copied ? 'COPIED' : 'LOBBY CODE · TAP TO COPY'}
                  </Text>
                  <Text style={[styles.lobbyCodeValue, { color: copied ? color.verified : color.base }]} numberOfLines={1}>
                    {fixture.lobbyCode}
                  </Text>
                </View>
                {copied && <Diamond size={13} color={color.verified} />}
              </View>
            )}
          </Pressable>
        ) : (
          <View style={styles.lobbyCodePendingBox}>
            <Text style={styles.lobbyCodePendingText}>Lobby code not set yet — check back closer to lock.</Text>
          </View>
        )}

        <View style={styles.factsGrid}>
          <View style={styles.factTile}>
            <Text style={[styles.factValue, tabularNums]}>{formatClock(fixture.scheduledAt)}</Text>
            <Text style={styles.factLabel}>{isTonight(fixture.scheduledAt) ? 'TONIGHT' : formatDay(fixture.scheduledAt)}</Text>
          </View>
          <View style={styles.factTile}>
            <Text style={[styles.factValue, tabularNums]}>Bo{fixture.bestOf}</Text>
            <Text style={styles.factLabel}>FORMAT</Text>
          </View>
          <View style={styles.factTile}>
            <Text style={[styles.factValue, tabularNums]}>{fixture.isHome ? 'HOME' : 'AWAY'}</Text>
            <Text style={styles.factLabel}>SIDE</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push({ pathname: '/(player)/teams/[teamId]/fixture-lineup', params: { teamId } } as any)}>
          {({ pressed, hovered }: any) => (
            <View style={[styles.setLineupButton, { backgroundColor: pressed ? color.emberActive : hovered ? color.emberHover : color.ember }]}>
              <Text style={styles.setLineupLabel}>Set your starting 5</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/(player)/fixtures/[fixtureId]/lobby', params: { fixtureId: fixture.id } } as any)}>
          <Text style={styles.lobbyLink}>Go to live score →</Text>
        </Pressable>
        <Text style={styles.lockNote}>Starting 5 locks {formatClock(fixture.lockAt)}, 10 minutes before the series starts.</Text>
      </View>
    </CornerCut>
  );
}

function LiveFixtureCard({ fixture }: { fixture: UpcomingFixture }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/(player)/fixtures/[fixtureId]/lobby', params: { fixtureId: fixture.id } } as any)}>
      <CornerCut cut={20} fill={color.panel} strokeColor={color.emberBorderSoft} style={{ width: '100%' }}>
        <View style={styles.nextCardContent}>
          <View style={styles.nextCardTopRow}>
            <View style={{ gap: 6 }}>
              <View style={styles.nextChip}>
                <View style={styles.nextChipDot} />
                <Text style={styles.nextChipLabel}>LIVE · IN PROGRESS</Text>
              </View>
              <Text style={styles.nextTitle}>vs {fixture.opponentName}</Text>
            </View>
          </View>

          <View style={styles.liveScoreRow}>
            <Text style={[styles.liveScoreValue, tabularNums]}>{fixture.myMapsWon}</Text>
            <Text style={styles.liveScoreDash}>–</Text>
            <Text style={[styles.liveScoreValue, tabularNums]}>{fixture.opponentMapsWon}</Text>
            <Text style={styles.liveScoreCaption}>Bo{fixture.bestOf} · tap for live score</Text>
          </View>

          {fixture.lobbyCode && (
            <View style={styles.lobbyCodePendingBox}>
              <Text style={[styles.lobbyCodePendingText, { color: color.textPrimary }]}>Lobby {fixture.lobbyCode}</Text>
            </View>
          )}
        </View>
      </CornerCut>
    </Pressable>
  );
}

function CompletedFixtureRow({ fixture }: { fixture: UpcomingFixture }) {
  const won = fixture.myMapsWon > fixture.opponentMapsWon;
  return (
    <View style={styles.laterRow}>
      <View style={styles.laterTopRow}>
        <View style={{ gap: 5, flex: 1, minWidth: 0 }}>
          <Text style={styles.laterTitle}>vs {fixture.opponentName}</Text>
          <Text style={styles.laterWhen}>{formatWhen(fixture.scheduledAt)}</Text>
        </View>
        <View style={styles.completedChip}>
          <Text style={[styles.completedChipLabel, { color: won ? color.verified : color.textMuted }]}>
            {won ? 'WON' : 'LOST'} {fixture.myMapsWon}–{fixture.opponentMapsWon}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LaterFixtureRow({ fixture }: { fixture: UpcomingFixture }) {
  return (
    <View style={styles.laterRow}>
      <View style={styles.laterTopRow}>
        <View style={{ gap: 5, flex: 1, minWidth: 0 }}>
          <Text style={styles.laterTitle}>vs {fixture.opponentName}</Text>
          <Text style={styles.laterWhen}>{formatWhen(fixture.scheduledAt)}</Text>
        </View>
      </View>
      <View style={styles.laterMetaRow}>
        <Text style={[styles.laterMetaText, tabularNums]}>Bo{fixture.bestOf}</Text>
        <View style={styles.laterMetaDivider} />
        <Text style={[styles.laterMetaText, tabularNums]}>{fixture.isHome ? 'Home' : 'Away'}</Text>
      </View>
    </View>
  );
}

function isTonight(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}
function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short' }).toUpperCase();
}
function formatWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatClock(iso)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 22, paddingBottom: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 18, color: color.textMuted },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, letterSpacing: 0.01 * 30, color: color.textPrimary },
  subtitle: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  list: { padding: 22, paddingTop: 18, gap: 14 },
  emptyBox: { padding: 24, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel },
  emptyText: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted },
  nextCardContent: { padding: 20, gap: 16 },
  nextCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: color.emberTint,
    borderWidth: 1,
    borderColor: color.emberTintBorder,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  nextChipDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.ember },
  nextChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.ember },
  nextTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 27, lineHeight: 28, letterSpacing: 0.01 * 27, color: color.textPrimary },
  countdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  countdownValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 46, color: color.ember },
  countdownCaption: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 16, color: color.textMuted },
  liveScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  liveScoreValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 46, color: color.textPrimary },
  liveScoreDash: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, color: color.textMuted },
  liveScoreCaption: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, marginLeft: 8 },
  lobbyCodeBox: { height: 56, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  lobbyCodeLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.1 * 10 },
  lobbyCodeValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, letterSpacing: 0.03 * 22, ...tabularNums },
  lobbyCodePendingBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.fillMuted, paddingVertical: 12, paddingHorizontal: 14 },
  lobbyCodePendingText: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  factsGrid: { flexDirection: 'row', backgroundColor: color.hairline, gap: 1 },
  factTile: { flex: 1, backgroundColor: color.panel, padding: 13, gap: 4 },
  factValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 17, color: color.textPrimary },
  factLabel: { fontFamily: fontFamily.interRegular, fontSize: 9, letterSpacing: 0.1 * 9, color: color.textMuted },
  setLineupButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  setLineupLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.base },
  lobbyLink: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.verified, textAlign: 'center' },
  lockNote: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, textAlign: 'center', ...tabularNums },
  sectionLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    textTransform: 'uppercase',
    color: color.textMuted,
    marginTop: 4,
  },
  laterRow: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 16, gap: 12 },
  laterTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  laterTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 18, letterSpacing: 0.01 * 18, color: color.textPrimary },
  laterWhen: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  laterMetaRow: { flexDirection: 'row', gap: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(242,241,236,0.1)', paddingTop: 11, flexWrap: 'wrap' },
  laterMetaText: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  laterMetaDivider: { width: 1, height: 11, backgroundColor: color.hairlineInput },
  completedChip: { borderWidth: 1, borderColor: color.hairlineStrong, paddingVertical: 4, paddingHorizontal: 8 },
  completedChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.1 * 9, ...tabularNums },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26, gap: 12, borderTopWidth: 1, borderTopColor: color.hairline },
  standingsButton: {
    height: 50,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  standingsLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.textPrimary },
  standingsMeta: { fontFamily: fontFamily.interRegular, fontSize: 15, color: color.textMuted, ...tabularNums },
});
