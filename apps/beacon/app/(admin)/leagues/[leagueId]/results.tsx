import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { AdminTallyRow } from '../../../../components/admin/AdminTally';
import { Spinner } from '../../../../components/Spinner';
import { PasswordConfirmPanel } from '../../../../components/PasswordConfirmPanel';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useAdminLeague } from '../../../../lib/api/adminLeagues';
import { ResultsListGame, useDeleteGame, useDeleteMatch, useResultsList } from '../../../../lib/api/adminResults';

// Not one of the 16 reference screens — the sidebar's "Results" item had
// nowhere of its own to go (it fell back to the Schedule table, which
// mixes every game status together). This lists every completed game in
// the league with its verification state, tapping through to the
// full per-team breakdown (screen 15).
//
// Head-to-head (Valorant pilot) leagues don't get a separate results list
// — Schedule's fixture table already shows every fixture's status with an
// "Enter scores"/"Results" link per row, so a second near-duplicate list
// would just be two places to keep in sync. Redirect there instead.
export default function AdminResultsList() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { data: league } = useAdminLeague(leagueId);
  const formatType = (league?.titles as any)?.format_type;
  if (formatType === 'head_to_head') return <Redirect href={`/(admin)/leagues/${leagueId}/schedule` as any} />;

  return <AdminResultsListApex leagueId={leagueId} league={league} />;
}

function AdminResultsListApex({ leagueId, league }: { leagueId: string; league: any }) {
  const { data: games, isLoading } = useResultsList(leagueId);
  const deleteGame = useDeleteGame(leagueId);
  const deleteMatch = useDeleteMatch(leagueId);

  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [deletingMatchRound, setDeletingMatchRound] = useState<number | null>(null);

  const publishedCount = (games ?? []).filter((g) => g.published).length;
  const pendingCount = (games ?? []).length - publishedCount;

  // Games are already ordered by scheduled_at desc — group by round while
  // keeping that order, so "Match X" headers appear in the same sequence
  // the flat list used to.
  const groups: { roundNumber: number; games: ResultsListGame[] }[] = [];
  for (const g of games ?? []) {
    let group = groups.find((gr) => gr.roundNumber === g.roundNumber);
    if (!group) {
      group = { roundNumber: g.roundNumber, games: [] };
      groups.push(group);
    }
    group.games.push(g);
  }

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
        <View style={{ gap: 24 }}>
          {groups.map((group) => (
            <View key={group.roundNumber} style={{ gap: 8 }}>
              <View style={styles.matchHeader}>
                <Text style={styles.sectionLabel}>Match {group.roundNumber}</Text>
                {group.games.length > 1 && deletingMatchRound !== group.roundNumber && (
                  <Pressable onPress={() => setDeletingMatchRound(group.roundNumber)}>
                    <View style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnLabel}>Delete match</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              {deletingMatchRound === group.roundNumber && (
                <PasswordConfirmPanel
                  label="DELETE THIS MATCH"
                  warning={`This permanently deletes all ${group.games.length} games in Match ${group.roundNumber} — their results, lineups, and substitution logs. Standings update immediately. This can't be undone.`}
                  confirmLabel="Delete match"
                  onCancel={() => setDeletingMatchRound(null)}
                  onConfirmed={async () => {
                    await deleteMatch.mutateAsync(group.roundNumber);
                    setDeletingMatchRound(null);
                  }}
                />
              )}

              <View style={{ gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline }}>
                {group.games.map((g) =>
                  deletingGameId === g.id ? (
                    <View key={g.id} style={styles.deleteRowWrap}>
                      <PasswordConfirmPanel
                        label="DELETE THIS GAME"
                        warning={`This permanently deletes Match ${g.roundNumber} · Game ${g.gameNumber} — its result, lineups, and substitution log. Standings update immediately. This can't be undone.`}
                        confirmLabel="Delete game"
                        onCancel={() => setDeletingGameId(null)}
                        onConfirmed={async () => {
                          await deleteGame.mutateAsync(g.id);
                          setDeletingGameId(null);
                        }}
                      />
                    </View>
                  ) : (
                    <ResultRow key={g.id} game={g} onDelete={() => setDeletingGameId(g.id)} />
                  ),
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </AdminShell>
  );
}

function ResultRow({ game: g, onDelete }: { game: ResultsListGame; onDelete: () => void }) {
  return (
    <View style={styles.rowOuter}>
      <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/(admin)/games/${g.id}/verify` as any)}>
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
      <Pressable onPress={onDelete}>
        <View style={styles.deleteBtn}>
          <Text style={styles.deleteBtnLabel}>Delete</Text>
        </View>
      </Pressable>
    </View>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${timePart}`;
}

const styles = StyleSheet.create({
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  rowOuter: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.panel, paddingRight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, paddingHorizontal: 20 },
  rowTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 19, color: color.textPrimary },
  rowMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  winnerName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  winnerPts: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  pendingText: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  deleteBtn: { paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: color.emberBorderStrong },
  deleteBtnLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.06 * 11, color: color.ember },
  deleteRowWrap: { backgroundColor: color.panel, padding: 18, paddingHorizontal: 20 },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 32, gap: 12, alignItems: 'flex-start' },
  emptyTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, color: color.textPrimary },
  emptyBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted, maxWidth: 460 },
});
