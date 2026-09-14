import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { supabase } from '../../../../lib/supabase';
import { useSession } from '../../../../lib/hooks/useSession';
import { StandingsRow, useStandings } from '../../../../lib/api/standings';

// Reference: Beacon 08 League Standings.dc.html
export default function LeagueStandings() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { userId } = useSession();
  const [expanded, setExpanded] = useState(false);

  const { data: myTeamId } = useQuery({
    queryKey: ['myTeamInLeague', leagueId, userId],
    queryFn: async () => {
      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('profile_id', userId as string);
      const teamIds = (memberships ?? []).map((m) => m.team_id);
      if (teamIds.length === 0) return undefined;
      const { data: reg } = await supabase
        .from('league_teams')
        .select('team_id')
        .eq('league_id', leagueId)
        .in('team_id', teamIds)
        .maybeSingle();
      return reg?.team_id;
    },
    enabled: !!userId && !!leagueId,
  });

  const { data, isLoading } = useStandings(leagueId, myTeamId);

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
      </SafeAreaView>
    );
  }

  const mineIdx = data.rows.findIndex((r) => r.isMine);
  const mine = mineIdx >= 0 ? data.rows[mineIdx] : null;
  const visible = expanded ? data.rows : data.rows.slice(0, 8);
  const showPinned = !expanded && mine && mineIdx >= 8;
  const above = mine && mineIdx > 0 ? data.rows[mineIdx - 1] : null;
  const progressPct = data.totalGames > 0 ? Math.round((data.completedGames / data.totalGames) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <View style={{ gap: 5 }}>
            <Text style={styles.title}>STANDINGS</Text>
            <Text style={styles.subtitle}>
              {data.leagueName}
              {data.seasonLabel ? ` · ${data.seasonLabel}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ gap: 9 }}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              STANDINGS AFTER {data.completedGames} OF {data.totalGames} GAMES
            </Text>
            <Text style={[styles.progressPct, tabularNums]}>{progressPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            {Array.from({ length: Math.max(data.totalGames, 1) }).map((_, i) => (
              <View key={i} style={[styles.progressSeg, { backgroundColor: i < data.completedGames ? color.textPrimary : 'rgba(242,241,236,0.16)' }]} />
            ))}
          </View>
          <View style={styles.progressFooterRow}>
            <Text style={[styles.progressFooterText, tabularNums]}>Points = placement + kills</Text>
            <Text style={[styles.progressFooterText, tabularNums]}>{data.registeredTeams} teams registered</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: 26 }]}>#</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TEAM</Text>
          <Text style={[styles.tableHeaderCell, { width: 46, textAlign: 'right' }]}>KILLS</Text>
          <Text style={[styles.tableHeaderCell, { width: 52, textAlign: 'right' }]}>PTS</Text>
        </View>

        {visible.map((r) => (
          <TableRow key={r.teamId} row={r} />
        ))}

        {showPinned && mine && (
          <View style={{ gap: 8, marginTop: 14 }}>
            <View style={styles.pinDividerRow}>
              <View style={styles.pinDividerLine} />
              <Text style={styles.pinDividerText}>YOUR TEAM</Text>
              <View style={styles.pinDividerLine} />
            </View>
            <View style={styles.pinnedOuter}>
              <View style={styles.pinnedContent}>
                <Text style={[styles.pinnedPos, tabularNums]}>{String(mine.rank).padStart(2, '0')}</Text>
                <View style={{ gap: 3, flex: 1, minWidth: 0 }}>
                  <Text style={styles.pinnedName}>{mine.name}</Text>
                  <Text style={[styles.pinnedGap, tabularNums]}>
                    {above ? `${above.points - mine.points} pts behind ${above.name}` : 'Top of the table'}
                  </Text>
                </View>
                <Text style={[styles.pinnedKills, tabularNums]}>{mine.kills}</Text>
                <Text style={[styles.pinnedPts, tabularNums]}>{mine.points}</Text>
              </View>
            </View>
          </View>
        )}

        <Pressable onPress={() => setExpanded((e) => !e)}>
          {({ pressed, hovered }: any) => (
            <View style={[styles.toggleButton, (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted }]}>
              <Text style={styles.toggleLabel}>{expanded ? 'Show top 8 only' : `View all ${data.registeredTeams} teams`}</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.footnote}>
          Placement and kill totals are read from EA after each lobby closes. Admin corrections are marked on the results screen.
        </Text>
      </ScrollView>

      <View style={styles.dockedFooter}>
        <Pressable onPress={() => router.push('/(player)/games')}>
          {({ pressed, hovered }: any) => (
            <View style={[styles.nextGameButton, { backgroundColor: pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary }]}>
              <Text style={styles.nextGameLabel}>Your next game</Text>
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TableRow({ row }: { row: StandingsRow }) {
  const isLeader = row.rank === 1;
  const accent = isLeader ? color.textPrimary : row.isMine ? color.verified : 'transparent';
  const rowBg = isLeader || row.isMine ? color.panel : 'transparent';
  const nameFg = isLeader || row.isMine ? color.textPrimary : color.textMuted;
  const ptsFg = isLeader ? color.textPrimary : row.isMine ? color.verified : color.textMuted;
  const sub = isLeader
    ? `Leader · ${row.gamesPlayed} games played`
    : row.isMine
      ? `Your team · ${row.gamesPlayed} games played`
      : `${row.gamesPlayed} games played`;

  return (
    <View style={[styles.row, { backgroundColor: rowBg, borderLeftColor: accent }]}>
      <Text style={[styles.rowPos, { color: isLeader ? color.textPrimary : color.textMuted }, tabularNums]}>{String(row.rank).padStart(2, '0')}</Text>
      <View style={{ gap: 3, flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowName, { color: nameFg }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.rowSub, tabularNums]}>{sub}</Text>
      </View>
      <Text style={[styles.rowKills, tabularNums]}>{row.kills}</Text>
      <Text style={[styles.rowPts, { color: ptsFg }, tabularNums]}>{row.points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 22, paddingBottom: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  back: { fontSize: 18, color: color.textMuted, paddingTop: 4 },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, letterSpacing: 0.01 * 28, color: color.textPrimary },
  subtitle: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  progressPct: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13, color: color.textMuted },
  progressTrack: { flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 4 },
  progressFooterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressFooterText: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  list: { padding: 22, paddingTop: 14 },
  tableHeader: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 2,
    paddingLeft: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,241,236,0.08)',
    borderLeftWidth: 2,
  },
  rowPos: { fontFamily: fontFamily.rajdhaniBold, fontSize: 15, width: 22 },
  rowName: { fontFamily: fontFamily.interSemiBold, fontSize: 14 },
  rowSub: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted },
  rowKills: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted, width: 46, textAlign: 'right' },
  rowPts: { fontFamily: fontFamily.rajdhaniBold, fontSize: 19, width: 52, textAlign: 'right' },
  pinDividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinDividerLine: { flex: 1, height: 1, backgroundColor: color.hairline },
  pinDividerText: { fontFamily: fontFamily.interRegular, fontSize: 10, letterSpacing: 0.1 * 10, color: color.textMuted },
  pinnedOuter: { borderWidth: 1, borderColor: color.verifiedTintBorder, backgroundColor: color.panel },
  pinnedContent: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 13, paddingHorizontal: 14 },
  pinnedPos: { fontFamily: fontFamily.rajdhaniBold, fontSize: 15, color: color.textPrimary, width: 22 },
  pinnedName: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  pinnedGap: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.verified },
  pinnedKills: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted, width: 46, textAlign: 'right' },
  pinnedPts: { fontFamily: fontFamily.rajdhaniBold, fontSize: 19, color: color.textPrimary, width: 52, textAlign: 'right' },
  toggleButton: { height: 44, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  toggleLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  footnote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, textAlign: 'center', marginTop: 10 },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26, gap: 10, borderTopWidth: 1, borderTopColor: color.hairline },
  nextGameButton: { height: 50, alignItems: 'center', justifyContent: 'center' },
  nextGameLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.base },
});
