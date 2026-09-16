import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BottomNav } from '../../components/BottomNav';
import { CornerCut } from '../../components/CornerCut';
import { Diamond } from '../../components/Diamond';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../theme/tokens';
import { formatRelativeTime } from '../../lib/time';
import { useCountdownLabel } from '../../lib/hooks/useCountdown';
import { useSession } from '../../lib/hooks/useSession';
import { useDashboard } from '../../lib/api/dashboard';

// Reference: Beacon 02 Stats Dashboard.dc.html — the landing screen right
// after account verification.
export default function StatsDashboard() {
  const { userId } = useSession();
  const { data, isLoading, refetch, isRefetching } = useDashboard(userId);
  const queryClient = useQueryClient();
  const [syncedAgo, setSyncedAgo] = useState<string | null>(null);

  const lockLabel = useCountdownLabel(data?.league?.nextGame?.lockAt ?? null);

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
        <BottomNav active="stats" />
      </SafeAreaView>
    );
  }

  const initials = (data.gamertag ?? '??').slice(0, 2).toUpperCase();
  const kd = data.stats?.kd;
  const wins = data.stats?.wins;
  const rank = data.stats?.rankName;
  const legend = data.stats?.mostPlayedLegend;

  async function handleRefresh() {
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
    setSyncedAgo('0 MIN AGO');
  }

  const league = data.league;
  const nextGame = league?.nextGame;
  const starterCount = nextGame?.starterCount ?? 0;
  const missingStarters = 3 - starterCount;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identityRow}>
          <CornerCut cut={12} fill="none" strokeColor={color.hairlineStrong} style={styles.avatar}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarLabel}>{initials}</Text>
            </View>
          </CornerCut>
          <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={styles.gamertag}>{data.gamertag ?? 'Player'}</Text>
              {data.isVerified && (
                <View style={styles.verifiedChip}>
                  <Diamond size={7} color={color.verified} />
                  <Text style={styles.verifiedChipLabel}>VERIFIED</Text>
                </View>
              )}
            </View>
            <Text style={styles.identityMeta}>
              {league ? `${league.teamName} · ${league.role === 'captain' ? 'Captain' : 'Member'}` : 'No team yet'}
            </Text>
          </View>
        </View>

        {data.isVerified && (
          <View style={styles.sourceLine}>
            <View style={styles.sourceLeft}>
              <Diamond size={8} color={color.verified} />
              <Text style={styles.sourceLabel}>READ FROM YOUR EA ACCOUNT</Text>
            </View>
            <Pressable onPress={handleRefresh} style={styles.syncRow}>
              {isRefetching && <Spinner size={10} />}
              <Text style={styles.syncLabel}>
                {isRefetching
                  ? 'Syncing…'
                  : `Synced ${syncedAgo ?? (data.stats?.fetchedAt ? formatRelativeTime(data.stats.fetchedAt) : '—')}`}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.statGridWrap}>
          <StatTile label="RANK" value={rank ?? '—'} sub={data.stats?.rankScore != null ? `${data.stats.rankScore.toLocaleString()} RP` : undefined} big={27} />
          <StatTile label="K/D RATIO" value={kd != null ? kd.toFixed(2) : '—'} big={40} />
          <StatTile label="WINS" value={wins != null ? String(wins) : '—'} big={40} />
          <StatTile label="MOST PLAYED" value={legend ?? '—'} big={30} />
        </View>

        {league ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionLabel}>Your league</Text>
            <Pressable onPress={() => router.push(`/(player)/leagues/${league.leagueId}/standings` as any)}>
              {({ hovered }: any) => (
                <CornerCut
                  cut={18}
                  fill={color.panel}
                  strokeColor={hovered ? color.hairlineStrong : color.hairline}
                  style={styles.leagueOuter}
                >
                  <View style={styles.leagueContent}>
                    <View style={styles.leagueHeaderRow}>
                      <View style={{ gap: 5 }}>
                        <Text style={styles.leagueName}>{league.leagueName}</Text>
                        <Text style={styles.leagueMeta}>
                          {league.standingRank ? `${ordinal(league.standingRank)} of ${league.standingTotal}` : 'Unranked'}
                          {' · '}
                          {league.points} pts
                          {league.totalRounds ? ` · Week ${league.nextGame?.roundNumber ?? '—'} of ${league.totalRounds}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>→</Text>
                    </View>

                    {nextGame && (
                      <View style={styles.nextMatchBlock}>
                        <Text style={styles.nextMatchLabel}>NEXT MATCH · 20-TEAM LOBBY</Text>
                        <View style={styles.nextMatchRow}>
                          <Text style={styles.nextMatchTitle}>
                            Match {nextGame.roundNumber} · Game {nextGame.gameNumber}
                          </Text>
                          <Text style={styles.nextMatchTime}>{formatTimeLabel(nextGame.scheduledAt)}</Text>
                        </View>
                        {lockLabel && missingStarters > 0 && (
                          <View style={styles.lockWarning}>
                            <View style={styles.lockDot} />
                            <Text style={styles.lockWarningText}>
                              Lineup locks in <Text style={styles.lockWarningTime}>{lockLabel}</Text> — {missingStarters}{' '}
                              starter{missingStarters === 1 ? '' : 's'} unconfirmed
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </CornerCut>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Looking for another division?</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.dockedFooter}>
        <Pressable onPress={() => router.push('/(player)/leagues')}>
          {({ pressed, hovered }: any) => (
            <View
              style={[
                styles.browseButton,
                (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted },
              ]}
            >
              <Text style={styles.browseButtonLabel}>Browse leagues</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.footerNote}>You can hold up to three teams across divisions.</Text>
      </View>

      <BottomNav active="stats" />
    </SafeAreaView>
  );
}

function StatTile({ label, value, sub, big }: { label: string; value: string; sub?: string; big: number }) {
  return (
    <CornerCut cut={14} fill={color.panel} strokeColor="rgba(62,213,152,0.3)" style={styles.statTileOuter}>
      <View style={styles.statTileContent}>
        <View style={styles.statTileHeader}>
          <Text style={styles.statTileLabel}>{label}</Text>
          <Diamond size={8} color={color.verified} />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={[styles.statTileValue, { fontSize: big, lineHeight: big }, tabularNums]} numberOfLines={1}>
            {value}
          </Text>
          {sub ? <Text style={styles.statTileSub}>{sub}</Text> : null}
        </View>
      </View>
    </CornerCut>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return isToday ? `Tonight ${time}` : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 22, paddingTop: 12, gap: 24 },
  identityRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 56, height: 56 },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 20, color: color.textPrimary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  gamertag: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26, letterSpacing: 0.01 * 26, color: color.textPrimary },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: color.verifiedTint,
    borderWidth: 1,
    borderColor: color.verifiedTintBorder,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  verifiedChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.verified },
  identityMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  sourceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.hairline,
    paddingVertical: 12,
  },
  sourceLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sourceLabel: { fontFamily: fontFamily.interMedium, fontSize: 10, letterSpacing: 0.1 * 10, color: color.verified },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  syncLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted, ...tabularNums },
  statGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statTileOuter: { flexBasis: '47%', flexGrow: 1 },
  statTileContent: { padding: 16, gap: 10, minHeight: 126, justifyContent: 'space-between' },
  statTileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  statTileLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  statTileValue: { fontFamily: fontFamily.rajdhaniBold, color: color.textPrimary },
  statTileSub: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  sectionLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  leagueOuter: { width: '100%' },
  leagueContent: { padding: 20, gap: 16 },
  leagueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  leagueName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 21, letterSpacing: 0.01 * 21, color: color.textPrimary },
  leagueMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  chevron: { fontFamily: fontFamily.interRegular, fontSize: 18, color: color.textMuted },
  nextMatchBlock: { gap: 10, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 16 },
  nextMatchLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  nextMatchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  nextMatchTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, lineHeight: 24, color: color.textPrimary },
  nextMatchTime: { fontFamily: fontFamily.rajdhaniBold, fontSize: 15, color: color.textMuted, ...tabularNums },
  lockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.emberTint,
    borderWidth: 1,
    borderColor: color.emberTintBorder,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  lockDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.ember },
  lockWarningText: { flex: 1, fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 16, color: color.ember },
  lockWarningTime: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13, ...tabularNums },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: color.hairline },
  dividerText: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26, gap: 12 },
  browseButton: {
    height: 50,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.textPrimary },
  footerNote: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, textAlign: 'center' },
});
