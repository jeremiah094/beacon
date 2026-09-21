import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useSession } from '../../../../lib/hooks/useSession';
import { useResolveTeamForGame } from '../../../../lib/api/matchLobby';
import { useGameResults } from '../../../../lib/api/gameResults';

// Reached by tapping a "Recently completed" game on the Upcoming Games
// screen (screen 07) — shows the per-team breakdown once the admin has
// verified results (screen 15). No fabricated rows: a team with no
// verified result shows "—", never a guessed placement or kill count.
export default function GameResults() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { userId } = useSession();
  const { data: teamId } = useResolveTeamForGame(gameId, userId);
  const { data, isLoading } = useGameResults(gameId, teamId);

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contextBar}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(player)/games'))}>
            <View style={styles.backButton}>
              <Text style={styles.backLabel}>←</Text>
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Text style={styles.contextTitle}>
              Match {data.roundNumber} · Game {data.gameNumber}
            </Text>
            <Text style={[styles.contextMeta, tabularNums]} numberOfLines={1}>
              {data.leagueName}
              {data.map ? ` · ${data.map}` : ''} · {formatWhen(data.scheduledAt)}
            </Text>
          </View>
          <View style={[styles.statusChip, data.published ? styles.statusChipFinal : styles.statusChipPending]}>
            <Diamond size={7} color={data.published ? color.verified : color.textMuted} />
            <Text style={[styles.statusChipLabel, { color: data.published ? color.verified : color.textMuted }]}>
              {data.published ? 'FINAL' : 'PENDING'}
            </Text>
          </View>
        </View>

        {!data.published ? (
          <CornerCut cut={18} fill={color.panel} strokeColor={color.hairline}>
            <View style={styles.pendingContent}>
              <Text style={styles.pendingTitle}>Results not published yet</Text>
              <Text style={styles.pendingBody}>
                The league admin hasn't verified this game's placement and kills yet. Check back shortly.
              </Text>
            </View>
          </CornerCut>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Final standings</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
              <View style={[styles.table, { minWidth: 520 }]}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: 34 }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TEAM</Text>
                  <Text style={[styles.tableHeaderCell, { width: 84, textAlign: 'right' }]}>KILL PTS</Text>
                  <Text style={[styles.tableHeaderCell, { width: 108, textAlign: 'right' }]}>PLACEMENT PTS</Text>
                  <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right' }]}>TOTAL</Text>
                </View>
                {data.rows.map((r, i) => {
                  const isWinner = i === 0 && r.totalPoints != null;
                  return (
                    <View
                      key={r.teamId}
                      style={[
                        styles.tableRow,
                        r.isMyTeam && styles.myTeamRow,
                        isWinner && { borderLeftWidth: 2, borderLeftColor: color.ember },
                      ]}
                    >
                      <View style={{ width: 34, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.rankCell, tabularNums, isWinner && { color: color.ember }]}>
                          {r.totalPoints != null ? i + 1 : '—'}
                        </Text>
                        {isWinner && <Diamond size={8} color={color.ember} />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {r.teamName}
                          {r.isMyTeam ? ' (You)' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.numCell, { width: 84 }, tabularNums]}>{r.kills ?? '—'}</Text>
                      <Text style={[styles.numCell, { width: 108 }, tabularNums]}>{r.placementPoints ?? '—'}</Text>
                      <Text style={[styles.totalCell, tabularNums]}>{r.totalPoints ?? '—'}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={styles.footnote}>Sorted by total points — placement points plus one per kill. Highest total wins.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 22, paddingTop: 12, gap: 18 },
  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: color.hairline, paddingBottom: 16 },
  backButton: { width: 34, height: 34, borderWidth: 1, borderColor: color.neutralBorder, alignItems: 'center', justifyContent: 'center' },
  backLabel: { fontSize: 15, color: color.textMuted },
  contextTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  contextMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 8 },
  statusChipFinal: { backgroundColor: color.verifiedTint, borderColor: color.verifiedTintBorder },
  statusChipPending: { backgroundColor: 'transparent', borderColor: color.hairlineInput },
  statusChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9 },
  pendingContent: { padding: 20, gap: 10 },
  pendingTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 19, color: color.textPrimary },
  pendingBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, textTransform: 'uppercase', color: color.textMuted },
  table: { borderWidth: 1, borderColor: color.hairline },
  tableHeaderRow: { flexDirection: 'row', gap: 12, padding: 10, paddingHorizontal: 14, backgroundColor: color.panel, borderBottomWidth: 1, borderBottomColor: color.hairline },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  tableRow: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.06)' },
  myTeamRow: { backgroundColor: color.panel },
  rankCell: { fontFamily: fontFamily.rajdhaniBold, fontSize: 15, color: color.textMuted },
  rowName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  numCell: { textAlign: 'right', fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted },
  totalCell: { width: 90, textAlign: 'right', fontFamily: fontFamily.rajdhaniBold, fontSize: 18, color: color.textPrimary },
  footnote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted },
});
