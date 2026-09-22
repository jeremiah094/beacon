import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminButton } from '../../../../components/admin/AdminButton';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { AdminTallyRow } from '../../../../components/admin/AdminTally';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useSession } from '../../../../lib/hooks/useSession';
import { placementPoints, useDeleteResult, useReopenResults, usePublishResults, useResultsGame } from '../../../../lib/api/adminResults';
import { PasswordConfirmPanel } from '../../../../components/admin/PasswordConfirmPanel';

// Reference: Beacon 15 Verify Results.dc.html. The source pre-fills every
// row from an "EA read" and flips a row to admin-entered only once
// touched. Beacon has no automatic match-results ingestion — apex-link-id
// verifies a player's identity and rank, not per-lobby placement/kills —
// so every row here starts genuinely empty and is admin-entered by
// construction. The EA/Admin provenance split stays in the UI (results.
// source already models it) for whenever that integration exists; a
// footnote says so rather than pretending today's data is auto-pulled.
export default function VerifyResults() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { userId } = useSession();
  const { data: game, isLoading } = useResultsGame(gameId);
  const publish = usePublishResults(gameId);
  const reopen = useReopenResults(gameId);
  const deleteResult = useDeleteResult(gameId);

  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [kills, setKills] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (game && !loaded) {
      const p: Record<string, string> = {};
      const k: Record<string, string> = {};
      for (const r of game.rows) {
        if (r.placement != null) p[r.teamId] = String(r.placement);
        if (r.kills != null) k[r.teamId] = String(r.kills);
      }
      setPlacements(p);
      setKills(k);
      setLoaded(true);
    }
  }, [game, loaded]);

  if (isLoading || !game) {
    return (
      <AdminShell active="results" breadcrumbs={[{ label: 'Results' }]} title="LOADING">
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      </AdminShell>
    );
  }

  const locked = game.locked;

  const decorated = game.rows.map((r) => {
    const placeRaw = placements[r.teamId] ?? '';
    const killsRaw = kills[r.teamId] ?? '';
    const placeNum = parseInt(placeRaw, 10);
    const killsNum = parseInt(killsRaw, 10);
    const placeValid = !isNaN(placeNum) && placeNum >= 1 && placeNum <= game.rows.length;
    const killsValid = !isNaN(killsNum) && killsNum >= 0;
    const missing = !placeValid || !killsValid;
    const total = placeValid && killsValid ? placementPoints(placeNum) + killsNum : null;
    return { ...r, placeRaw, killsRaw, placeNum, killsNum, placeValid, killsValid, missing, total };
  });

  const missingRows = decorated.filter((r) => r.missing);
  const filledRows = decorated.filter((r) => !r.missing);
  const autoCount = 0; // no rows are ever source: 'api' yet — see file header note.
  const manualCount = filledRows.length;
  const ready = missingRows.length === 0;
  const visible = onlyIssues ? decorated.filter((r) => r.missing) : decorated;

  const podium = filledRows
    .slice()
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, 3);

  async function handlePublish() {
    if (!ready || !userId) return;
    await publish.mutateAsync({
      entries: decorated.map((r) => ({ teamId: r.teamId, placement: r.placeNum, kills: r.killsNum })),
      adminId: userId,
    });
    setJustPublished(true);
  }

  async function handleReopen() {
    await reopen.mutateAsync();
    setJustPublished(false);
  }

  const published = locked || justPublished;

  return (
    <AdminShell
      active="results"
      activeLeagueId={game.leagueId}
      breadcrumbs={[
        { label: game.leagueName, href: `/(admin)/leagues/create?leagueId=${game.leagueId}` as any },
        { label: 'Results', href: `/(admin)/leagues/${game.leagueId}/results` as any },
        { label: `Match ${game.roundNumber} · Game ${game.gameNumber}` },
      ]}
      title="VERIFY RESULTS"
      titleMeta={`Match ${game.roundNumber} · Game ${game.gameNumber} · ${game.map ?? 'Map TBC'}`}
      actions={<AdminChip label={published ? 'PUBLISHED · STANDINGS UPDATED' : 'AWAITING VERIFICATION'} tone={published ? 'verified' : 'neutral'} dotShape="circle" />}
      belowTopBar={
        <View style={styles.provenanceStrip}>
          <AdminTallyRow
            items={[
              { n: autoCount, label: 'EA VERIFIED', fg: color.verified },
              { n: manualCount, label: 'ADMIN ENTERED' },
              { n: missingRows.length, label: 'MISSING', fg: missingRows.length ? color.ember : color.verified },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
            <LegendItem shape="diamond" color={color.verified} label="Read from EA after the lobby closed" />
            <LegendItem shape="square" color={color.textMuted} label="Entered by an organiser — carries your name in the record" />
          </View>
        </View>
      }
      rail={
        <>
          <Text style={styles.railTitle}>{published ? 'Published to standings' : 'Result preview'}</Text>

          <CornerCut cut={20} fill={color.panel} strokeColor={published ? color.verifiedTintBorder : color.hairline}>
            <View style={styles.podiumContent}>
              <Text style={styles.podiumTitle}>TOP OF THIS GAME</Text>
              {podium.length === 0 ? (
                <Text style={styles.podiumEmpty}>Fill in placements and kills to see a preview.</Text>
              ) : (
                podium.map((p) => (
                  <View key={p.teamId} style={styles.podiumRow}>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline', flex: 1, minWidth: 0 }}>
                      <Text style={[styles.podiumPlace, tabularNums]}>{String(p.placeNum).padStart(2, '0')}</Text>
                      <Text style={styles.podiumName} numberOfLines={1}>{p.teamName}</Text>
                    </View>
                    <Text style={[styles.podiumTotal, tabularNums]}>{p.total}</Text>
                  </View>
                ))
              )}
              <Text style={styles.standingsNote}>
                {published ? `${game.leagueName} standings now include this game.` : `Publishing adds these totals to ${game.leagueName} standings and pushes the result to every player in the lobby.`}
              </Text>
            </View>
          </CornerCut>

          <View style={styles.subLogCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={styles.subLogLabel}>SUBSTITUTION LOG</Text>
              <Text style={styles.subLogHint}>Dispute reference</Text>
            </View>
            {game.subLog.length === 0 ? (
              <Text style={styles.subLogEmpty}>No substitutions were applied to this game.</Text>
            ) : (
              game.subLog.map((s) => (
                <View key={s.id} style={styles.subLogEntry}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={styles.subLogTeam}>{s.teamName}</Text>
                    <Text style={[styles.subLogTime, tabularNums]}>{formatClockTime(s.appliedAt)}</Text>
                  </View>
                  <Text style={styles.subLogDetail}>
                    {s.inName} substituted in for {s.outName}, approved by {s.appliedByName}
                    {s.reason ? ` — ${s.reason}` : ''}.
                  </Text>
                </View>
              ))
            )}
            <Text style={styles.subLogFooter}>Every substitution applied to this game is kept with the result permanently, whoever approved it.</Text>
          </View>

          {!published && !ready && (
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>
                {missingRows.length} {missingRows.length === 1 ? 'team has' : 'teams have'} no result yet. Publish is blocked until every row has a placement and a kill count — a blank is not a zero.
              </Text>
            </View>
          )}

          <AdminButton
            label={published ? 'Results published' : 'Publish results'}
            height={52}
            disabled={published || !ready || publish.isPending}
            onPress={handlePublish}
          />

          {published && (
            <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
              <Diamond size={9} color={color.verified} style={{ marginTop: 4 }} />
              <Text style={styles.publishedNote}>Standings updated. Every player in this lobby can see the result.</Text>
            </View>
          )}

          {locked && (
            <Pressable onPress={handleReopen} disabled={reopen.isPending}>
              <Text style={styles.resetLabel}>Reopen for correction</Text>
            </Pressable>
          )}
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ gap: 5 }}>
          <Text style={styles.sectionLabel}>Per-team result</Text>
          <Text style={styles.editHint}>
            {locked ? 'Locked while published. Reopen for correction to edit placement or kills.' : 'Placement points + 1 per kill. Fill both cells for every team.'}
          </Text>
        </View>
        <Pressable onPress={() => setOnlyIssues((v) => !v)}>
          <View style={[styles.issuesChip, onlyIssues ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
            <Text style={[styles.issuesChipLabel, onlyIssues && { color: color.base }]}>{onlyIssues ? 'Showing missing only' : 'Show missing only'}</Text>
          </View>
        </Pressable>
      </View>

      {locked && (
        <View style={styles.lockedBanner}>
          <Diamond size={9} color={color.verified} />
          <Text style={styles.lockedText}>Published and locked. Standings are live — use Reopen for correction to edit, which retracts the result until republished.</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
      <View style={[styles.table, { minWidth: 560 }]}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: 66 }]}>PLACE</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TEAM</Text>
          <Text style={[styles.tableHeaderCell, { width: 84 }]}>KILLS</Text>
          <Text style={[styles.tableHeaderCell, { width: 108, textAlign: 'right' }]}>PLACE + KILLS</Text>
          <Text style={[styles.tableHeaderCell, { width: 84, textAlign: 'right' }]}>TOTAL</Text>
        </View>
        {visible.map((r) => (
          <View key={r.teamId} style={[styles.tableRow, r.missing && { backgroundColor: color.panel, borderLeftWidth: 2, borderLeftColor: color.ember }]}>
            <TextInput
              value={r.placeRaw}
              onChangeText={(v) => setPlacements((s) => ({ ...s, [r.teamId]: v }))}
              editable={!locked}
              keyboardType="number-pad"
              style={[styles.placeInput, !r.placeValid && r.placeRaw !== '' && styles.invalidInput, tabularNums]}
            />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <Text style={styles.rowName} numberOfLines={1}>{r.teamName}</Text>
              <AdminChip label={r.missing ? 'MISSING' : 'ADMIN'} tone={r.missing ? 'ember' : 'neutral'} dotShape={r.missing ? 'circle' : 'diamond'} />
              {!r.missing && (
                <Pressable onPress={() => setDeletingTeamId(r.teamId)}>
                  <Text style={styles.deleteRowLabel}>Delete</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              value={r.killsRaw}
              onChangeText={(v) => setKills((s) => ({ ...s, [r.teamId]: v }))}
              editable={!locked}
              keyboardType="number-pad"
              style={[styles.killsInput, r.missing && r.killsRaw === '' && styles.invalidInput, tabularNums]}
            />
            <Text style={[styles.breakdownCell, tabularNums]}>{r.total != null ? `${placementPoints(r.placeNum)} + ${r.killsNum}` : '—'}</Text>
            <Text style={[styles.totalCell, { color: r.missing ? color.ember : color.textPrimary }, tabularNums]}>{r.total ?? '—'}</Text>
          </View>
        ))}
      </View>
      </ScrollView>

      {deletingTeamId && (
        <PasswordConfirmPanel
          label="DELETE THIS RESULT"
          warning={`This permanently removes ${decorated.find((r) => r.teamId === deletingTeamId)?.teamName ?? 'this team'}'s result for this game${published ? ' and updates standings immediately' : ''}. This can't be undone.`}
          confirmLabel="Delete result"
          onCancel={() => setDeletingTeamId(null)}
          onConfirmed={async () => {
            await deleteResult.mutateAsync(deletingTeamId);
            setDeletingTeamId(null);
          }}
        />
      )}

      {missingRows.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
          <View style={styles.flagBar} />
          <Text style={styles.flagText}>
            {missingRows.map((r) => r.teamName).join(', ')} {missingRows.length === 1 ? 'has' : 'have'} no result yet. If EA returned nothing because the team never entered the lobby, enter 0 kills and their placement to record it — a blank is not a zero.
          </Text>
        </View>
      )}
    </AdminShell>
  );
}

function LegendItem({ shape, color: c, label }: { shape: 'diamond' | 'square'; color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      {shape === 'diamond' ? <Diamond size={9} color={c} /> : <View style={{ width: 9, height: 9, borderWidth: 1, borderColor: c }} />}
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  provenanceStrip: { paddingVertical: 16, paddingHorizontal: 28, borderBottomWidth: 1, borderBottomColor: color.hairline, backgroundColor: '#0E0F12', flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap' },
  legendLabel: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15, color: color.textMuted },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  editHint: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  issuesChip: { paddingVertical: 8, paddingHorizontal: 13, borderWidth: 1 },
  issuesChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textMuted },
  lockedBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: color.verifiedTintBorder, backgroundColor: color.verifiedTint, padding: 13 },
  lockedText: { flex: 1, fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 17, color: color.verified },
  table: { borderWidth: 1, borderColor: color.hairline },
  tableHeaderRow: { flexDirection: 'row', gap: 12, padding: 10, paddingHorizontal: 14, backgroundColor: color.panel, borderBottomWidth: 1, borderBottomColor: color.hairline },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  tableRow: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.06)' },
  placeInput: { width: 56, height: 34, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontFamily: fontFamily.rajdhaniBold, fontSize: 16, paddingHorizontal: 9 },
  killsInput: { width: 74, height: 34, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontFamily: fontFamily.interRegular, fontSize: 13, paddingHorizontal: 10 },
  invalidInput: { backgroundColor: color.emberTint, borderColor: color.emberTintBorder },
  rowName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary, flexShrink: 1 },
  deleteRowLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.06 * 10, color: color.ember, marginLeft: 'auto' },
  breakdownCell: { width: 108, textAlign: 'right', fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted },
  totalCell: { width: 84, textAlign: 'right', fontFamily: fontFamily.rajdhaniBold, fontSize: 18 },
  flagBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  flagText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  podiumContent: { padding: 20, gap: 14 },
  podiumTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  podiumEmpty: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  podiumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  podiumPlace: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13, color: color.textMuted },
  podiumName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary, flexShrink: 1 },
  podiumTotal: { fontFamily: fontFamily.rajdhaniBold, fontSize: 17, color: color.textPrimary },
  standingsNote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 12 },
  subLogCard: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 18, gap: 13 },
  subLogLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  subLogHint: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted },
  subLogEmpty: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  subLogEntry: { gap: 6, borderLeftWidth: 2, borderLeftColor: color.hairlineStrong, paddingLeft: 12 },
  subLogTeam: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  subLogTime: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted },
  subLogDetail: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted },
  subLogFooter: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 12 },
  noteRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  publishedNote: { flex: 1, fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 17, color: color.verified },
  resetLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted, textAlign: 'center' },
});
