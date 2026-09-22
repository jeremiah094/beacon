import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { AdminTallyRow } from '../../../../components/admin/AdminTally';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useAdminLeague } from '../../../../lib/api/adminLeagues';
import { ResultsListGame, useResultsList } from '../../../../lib/api/adminResults';

// Not one of the 16 reference screens — the sidebar's "Results" item had
// nowhere of its own to go (it fell back to the Schedule table, which
// mixes every game status together). This lists every completed game in
// the league with its verification state, tapping through to the
// full per-team breakdown (screen 15).
export default function AdminResultsList() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { data: league } = useAdminLeague(leagueId);
  const { data: games, isLoading } = useResultsList(leagueId);

  const publishedCount = (games ?? []).filter((g) => g.published).length;
  const pendingCount = (games ?? []).length - publishedCount;

  return (
    <AdminShell
      active="results"
      activeLeagueId={leagueId}
      breadcrumbs={[
        { label: 'Leagues', href: '/(admin)/leagues' },
        { label: league?.name ?? 'League', href: `/(admin)/leagues/create?leagueId=${leagueId}` as any },
        { label: 'Results' },
      ]}
      title="RESULTS"
      actions={
        <AdminTallyRow
          items={[
            { n: publishedCount, label: 'PUBLISHED', fg: color.verified },
            { n: pendingCount, label: 'AWAITING VERIFICATION', fg: pendingCount ? color.ember : color.textMuted },
          ]}
        />
      }
    >
      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      ) : !games || games.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No results to display</Text>
          <Text style={styles.emptyBody}>
            Results appear here once a game finishes and its placements and kills are verified. Nothing in this league has completed yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline }}>
          {games.map((g) => (
            <ResultRow key={g.id} game={g} />
          ))}
        </View>
      )}
    </AdminShell>
  );
}

function ResultRow({ game: g }: { game: ResultsListGame }) {
  return (
    <Pressable onPress={() => router.push(`/(admin)/games/${g.id}/verify` as any)}>
      {({ hovered }: any) => (
        <View style={[styles.row, hovered && { backgroundColor: 'rgba(242,241,236,0.04)' }]}>
          <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle}>
              Match {g.roundNumber} · Game {g.gameNumber}
            </Text>
            <Text style={[styles.rowMeta, tabularNums]}>
              {formatWhen(g.scheduledAt)}
              {g.map ? ` · ${g.map}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4, minWidth: 0 }}>
            {g.published && g.topTeamName ? (
              <>
                <Text style={styles.winnerName} numberOfLines={1}>{g.topTeamName}</Text>
                <Text style={[styles.winnerPts, tabularNums]}>{g.topTeamPoints} pts · winner</Text>
              </>
            ) : (
              <Text style={styles.pendingText}>No result yet</Text>
            )}
          </View>
          <AdminChip label={g.published ? 'PUBLISHED' : 'AWAITING VERIFICATION'} tone={g.published ? 'verified' : 'ember'} dotShape={g.published ? 'diamond' : 'circle'} />
        </View>
      )}
    </Pressable>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${timePart}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, paddingHorizontal: 20, backgroundColor: color.panel },
  rowTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 19, color: color.textPrimary },
  rowMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  winnerName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  winnerPts: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  pendingText: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 32, gap: 12, alignItems: 'flex-start' },
  emptyTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, color: color.textPrimary },
  emptyBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted, maxWidth: 460 },
});
