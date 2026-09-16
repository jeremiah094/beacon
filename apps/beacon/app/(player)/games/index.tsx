import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BottomNav } from '../../../components/BottomNav';
import { CornerCut } from '../../../components/CornerCut';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../theme/tokens';
import { useCountdownLabel } from '../../../lib/hooks/useCountdown';
import { useSession } from '../../../lib/hooks/useSession';
import { useActiveTeam } from '../../../lib/hooks/useActiveTeam';
import { useMyTeams } from '../../../lib/api/teams';
import { UpcomingGame, useToggleGameMute, useUpcomingGames } from '../../../lib/api/games';

// Reference: Beacon 07 Upcoming Games.dc.html — no "vs", every game states
// "20 teams · one lobby" instead.
export default function UpcomingGames() {
  const { userId } = useSession();
  const { data: myTeams } = useMyTeams(userId);
  const { activeTeamId } = useActiveTeam((myTeams ?? []).map((t) => t.id));
  const { data, isLoading } = useUpcomingGames(activeTeamId ?? undefined, userId);
  const toggleMute = useToggleGameMute(activeTeamId ?? undefined, userId);

  const activeTeam = myTeams?.find((t) => t.id === activeTeamId);

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

  const [nextGame, ...laterGames] = data.games;
  const mutedCount = data.games.filter((g) => g.muted).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>UPCOMING GAMES</Text>
        </View>
        <Text style={styles.subtitle}>
          {data.teamName}
          {data.leagueName ? ` · ${data.leagueName}` : ''} · {data.games.length} fixture{data.games.length === 1 ? '' : 's'} left
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {nextGame ? (
          <NextGameCard game={nextGame} onToggleMute={() => toggleMute.mutate({ gameId: nextGame.id, muted: !nextGame.muted })} teamId={activeTeamId!} />
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No games scheduled yet.</Text>
          </View>
        )}

        {laterGames.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Later this season</Text>
            {laterGames.map((g) => (
              <LaterGameRow key={g.id} game={g} onToggleMute={() => toggleMute.mutate({ gameId: g.id, muted: !g.muted })} />
            ))}
          </>
        )}

        <View style={styles.scoringBox}>
          <Text style={styles.scoringLabel}>HOW POINTS WORK</Text>
          <View style={styles.scoringRow}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.scoringHeading}>Placement</Text>
              <Text style={styles.scoringBody}>12 pts for first, sliding to 1 pt for 11th–15th, 0 below.</Text>
            </View>
            <View style={styles.scoringDivider} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.scoringHeading}>+ Kills</Text>
              <Text style={styles.scoringBody}>1 pt per kill, counted across the whole trio.</Text>
            </View>
          </View>
          <Text style={styles.scoringFooter}>
            Your round score is the sum of both. Kills are read from EA, so they carry the verified mark on the results screen.
          </Text>
        </View>
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
        <Text style={styles.mutedSummary}>
          {mutedCount === 0
            ? 'Notifications on for every game.'
            : `${mutedCount} game${mutedCount === 1 ? '' : 's'} muted · league-wide notifications stay on.`}
        </Text>
      </View>

      <BottomNav active="games" />
    </SafeAreaView>
  );
}

function NextGameCard({ game, onToggleMute, teamId }: { game: UpcomingGame; onToggleMute: () => void; teamId: string }) {
  const countdown = useCountdownLabel(game.scheduledAt) ?? '0h 00m 00s';
  return (
    <CornerCut cut={20} fill={color.panel} strokeColor={color.emberBorderSoft} style={{ width: '100%' }}>
      <View style={styles.nextCardContent}>
        <View style={styles.nextCardTopRow}>
          <View style={{ gap: 6 }}>
            <View style={styles.nextChip}>
              <View style={styles.nextChipDot} />
              <Text style={styles.nextChipLabel}>NEXT GAME</Text>
            </View>
            <Text style={styles.nextTitle}>
              Match {game.roundNumber} · Game {game.gameNumber}
            </Text>
          </View>
          <BellButton muted={game.muted} onPress={onToggleMute} size={38} />
        </View>

        <View style={styles.countdownRow}>
          <Text style={[styles.countdownValue, tabularNums]}>{countdown}</Text>
          <Text style={styles.countdownCaption}>until the lobby opens</Text>
        </View>

        <View style={styles.factsGrid}>
          <View style={styles.factTile}>
            <Text style={[styles.factValue, tabularNums]}>{formatClock(game.scheduledAt)}</Text>
            <Text style={styles.factLabel}>{isTonight(game.scheduledAt) ? 'TONIGHT' : formatDay(game.scheduledAt)}</Text>
          </View>
          <View style={styles.factTile}>
            <Text style={styles.factValue}>{game.map ?? '—'}</Text>
            <Text style={styles.factLabel}>MAP</Text>
          </View>
          <View style={styles.factTile}>
            <Text style={[styles.factValue, tabularNums]}>20 teams</Text>
            <Text style={styles.factLabel}>ONE LOBBY</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push({ pathname: '/(player)/teams/[teamId]/lineup', params: { teamId } } as any)}>
          {({ pressed, hovered }: any) => (
            <View style={[styles.setLineupButton, { backgroundColor: pressed ? color.emberActive : hovered ? color.emberHover : color.ember }]}>
              <Text style={styles.setLineupLabel}>Set your lineup</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.lockNote}>Lineup locks {formatClock(game.lockAt)}, 10 minutes before the lobby opens.</Text>
      </View>
    </CornerCut>
  );
}

function LaterGameRow({ game, onToggleMute }: { game: UpcomingGame; onToggleMute: () => void }) {
  return (
    <View style={styles.laterRow}>
      <View style={styles.laterTopRow}>
        <View style={{ gap: 5, flex: 1, minWidth: 0 }}>
          <Text style={styles.laterTitle}>
            Match {game.roundNumber} · Game {game.gameNumber}
          </Text>
          <Text style={styles.laterWhen}>{formatWhen(game.scheduledAt)}</Text>
        </View>
        <BellButton muted={game.muted} onPress={onToggleMute} size={36} />
      </View>
      <View style={styles.laterMetaRow}>
        <Text style={[styles.laterMetaText, tabularNums]}>{game.map ?? '—'}</Text>
        <View style={styles.laterMetaDivider} />
        <Text style={[styles.laterMetaText, tabularNums]}>20 teams · one lobby</Text>
        {game.muted && (
          <View style={styles.mutedChip}>
            <Text style={styles.mutedChipLabel}>MUTED</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function BellButton({ muted, onPress, size }: { muted: boolean; onPress: () => void; size: number }) {
  const fg = muted ? color.textMuted : color.textPrimary;
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.bell,
          { width: size, height: size, borderColor: muted ? color.hairlineInput : color.hairlineStrong, backgroundColor: muted ? 'transparent' : color.fillMuted },
        ]}
      >
        <View style={{ alignItems: 'center', gap: 1.5 }}>
          <View style={[styles.bellDome, { borderColor: fg }]} />
          <View style={[styles.bellBase, { backgroundColor: fg }]} />
          <View style={[styles.bellClapper, { backgroundColor: fg }]} />
        </View>
        {muted && <View style={[styles.bellStrike, { backgroundColor: fg }]} />}
      </View>
    </Pressable>
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
  factsGrid: { flexDirection: 'row', backgroundColor: color.hairline, gap: 1 },
  factTile: { flex: 1, backgroundColor: color.panel, padding: 13, gap: 4 },
  factValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 17, color: color.textPrimary },
  factLabel: { fontFamily: fontFamily.interRegular, fontSize: 9, letterSpacing: 0.1 * 9, color: color.textMuted },
  setLineupButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  setLineupLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.base },
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
  mutedChip: { marginLeft: 'auto', borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 3, paddingHorizontal: 6 },
  mutedChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  bell: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bellDome: { width: 13, height: 9, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  bellBase: { width: 17, height: 1.5 },
  bellClapper: { width: 4, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  bellStrike: { position: 'absolute', width: 26, height: 1.5, transform: [{ rotate: '-45deg' }] },
  scoringBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 18, gap: 12, marginTop: 4 },
  scoringLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  scoringRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  scoringHeading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, color: color.textPrimary, ...tabularNums },
  scoringBody: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15.5, color: color.textMuted },
  scoringDivider: { width: 1, backgroundColor: color.hairline },
  scoringFooter: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 11 },
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
  mutedSummary: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, textAlign: 'center' },
});
