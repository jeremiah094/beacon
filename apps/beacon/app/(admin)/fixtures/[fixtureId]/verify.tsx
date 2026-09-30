import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminButton } from '../../../../components/admin/AdminButton';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useFixtureDetail, useReopenFixture, useSaveFixtureMaps } from '../../../../lib/api/adminFixtures';

type MapRow = { mapNumber: number; mapName: string; homeScore: string; awayScore: string };

// Head-to-head equivalent of games/[gameId]/verify.tsx — a fixture is a
// best-of-N series between two teams instead of one battle-royale lobby,
// so "results" here means a map score per game in the series, not a
// placement+kills table. Publishing computes the series winner from map
// wins and writes it to fixtures (home_score/away_score/winner_team_id).
export default function VerifyFixture() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { data: fixture, isLoading } = useFixtureDetail(fixtureId);
  const saveMaps = useSaveFixtureMaps(fixture?.leagueId);
  const reopen = useReopenFixture(fixture?.leagueId);

  const [rows, setRows] = useState<MapRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  useEffect(() => {
    if (fixture && !loaded) {
      if (fixture.maps.length > 0) {
        setRows(fixture.maps.map((m) => ({ mapNumber: m.mapNumber, mapName: m.mapName ?? '', homeScore: m.homeScore != null ? String(m.homeScore) : '', awayScore: m.awayScore != null ? String(m.awayScore) : '' })));
      } else {
        setRows(Array.from({ length: fixture.bestOf }, (_, i) => ({ mapNumber: i + 1, mapName: '', homeScore: '', awayScore: '' })));
      }
      setLoaded(true);
    }
  }, [fixture, loaded]);

  if (isLoading || !fixture) {
    return (
      <AdminShell active="results" breadcrumbs={[{ label: 'Results' }]} title="LOADING">
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      </AdminShell>
    );
  }

  const published = fixture.status === 'completed' || justPublished;

  const decorated = rows.map((r) => {
    const h = parseInt(r.homeScore, 10);
    const a = parseInt(r.awayScore, 10);
    const filled = r.homeScore.trim() !== '' && r.awayScore.trim() !== '' && !isNaN(h) && !isNaN(a);
    const tied = filled && h === a;
    return { ...r, h, a, filled, tied };
  });

  const filledRows = decorated.filter((r) => r.filled);
  const homeWins = filledRows.filter((r) => r.h > r.a).length;
  const awayWins = filledRows.filter((r) => r.a > r.h).length;
  const anyTied = decorated.some((r) => r.tied);
  const ready = filledRows.length > 0 && !anyTied && homeWins !== awayWins;

  function updateRow(mapNumber: number, patch: Partial<MapRow>) {
    setRows((prev) => prev.map((r) => (r.mapNumber === mapNumber ? { ...r, ...patch } : r)));
    setJustPublished(false);
  }

  function addMap() {
    setRows((prev) => [...prev, { mapNumber: (prev[prev.length - 1]?.mapNumber ?? 0) + 1, mapName: '', homeScore: '', awayScore: '' }]);
  }

  function removeMap(mapNumber: number) {
    setRows((prev) => prev.filter((r) => r.mapNumber !== mapNumber).map((r, i) => ({ ...r, mapNumber: i + 1 })));
  }

  async function handlePublish() {
    if (!ready) return;
    setSaveError(null);
    try {
      await saveMaps.mutateAsync({
        fixtureId: fixtureId as string,
        homeTeamId: fixture!.homeTeamId,
        awayTeamId: fixture!.awayTeamId,
        maps: filledRows.map((r) => ({ mapNumber: r.mapNumber, mapName: r.mapName, homeScore: r.h, awayScore: r.a })),
      });
      setJustPublished(true);
    } catch (err) {
      const message = (err as { message?: string } | null)?.message;
      setSaveError(message || 'Could not publish this result. Try again.');
    }
  }

  async function handleReopen() {
    await reopen.mutateAsync(fixtureId as string);
    setJustPublished(false);
  }

  return (
    <AdminShell
      active="results"
      activeLeagueId={fixture.leagueId}
      breadcrumbs={[
        { label: fixture.leagueName, href: `/(admin)/leagues/create?leagueId=${fixture.leagueId}` as any },
        { label: 'Schedule', href: `/(admin)/leagues/${fixture.leagueId}/schedule` as any },
        { label: `${fixture.homeTeamName} vs ${fixture.awayTeamName}` },
      ]}
      title="ENTER SERIES SCORE"
      titleMeta={`${fixture.homeTeamName} vs ${fixture.awayTeamName} · Bo${fixture.bestOf} · Round ${fixture.roundNumber}`}
      actions={<AdminChip label={published ? 'PUBLISHED · STANDINGS UPDATED' : 'AWAITING RESULT'} tone={published ? 'verified' : 'neutral'} dotShape="circle" />}
      rail={
        <>
          <Text style={styles.railTitle}>{published ? 'Published to standings' : 'Series preview'}</Text>
          <CornerCut cut={20} fill={color.panel} strokeColor={published ? color.verifiedTintBorder : color.hairline}>
            <View style={styles.previewContent}>
              <View style={styles.previewRow}>
                <Text style={styles.previewTeam} numberOfLines={1}>{fixture.homeTeamName}</Text>
                <Text style={[styles.previewScore, homeWins > awayWins && { color: color.verified }]}>{homeWins}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewTeam} numberOfLines={1}>{fixture.awayTeamName}</Text>
                <Text style={[styles.previewScore, awayWins > homeWins && { color: color.verified }]}>{awayWins}</Text>
              </View>
              <Text style={styles.standingsNote}>
                {published
                  ? `${fixture.leagueName} standings now include this series.`
                  : `Publishing awards 3 points to whichever team wins more maps, and updates ${fixture.leagueName} standings.`}
              </Text>
            </View>
          </CornerCut>

          {!published && anyTied && (
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>Every map needs a winner — a tied score can't be published.</Text>
            </View>
          )}
          {!published && !anyTied && filledRows.length > 0 && homeWins === awayWins && (
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>The series is tied {homeWins}–{awayWins} — add or correct a map so one side has more wins.</Text>
            </View>
          )}
          {saveError && (
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>{saveError}</Text>
            </View>
          )}

          <AdminButton label={published ? 'Result published' : 'Publish result'} height={52} disabled={published || !ready || saveMaps.isPending} onPress={handlePublish} />

          {published && (
            <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
              <Diamond size={9} color={color.verified} style={{ marginTop: 4 }} />
              <Text style={styles.publishedNote}>Standings updated for both teams.</Text>
            </View>
          )}

          {fixture.status === 'completed' && (
            <Pressable onPress={handleReopen} disabled={reopen.isPending}>
              <Text style={styles.resetLabel}>Reopen for correction</Text>
            </Pressable>
          )}
        </>
      }
    >
      <View style={{ gap: 5 }}>
        <Text style={styles.sectionLabel}>Map scores</Text>
        <Text style={styles.editHint}>Rounds won per map. Leave unplayed maps out — a Bo3 that finished 2–0 only needs 2 rows.</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: 50 }]}>MAP</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>NAME (OPTIONAL)</Text>
          <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'center' }]}>{fixture.homeTeamName.toUpperCase()}</Text>
          <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'center' }]}>{fixture.awayTeamName.toUpperCase()}</Text>
          <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'right' }]}>ACTIONS</Text>
        </View>
        {decorated.map((r) => (
          <View key={r.mapNumber} style={[styles.tableRow, r.tied && { backgroundColor: color.emberTint }]}>
            <Text style={[styles.mapNumber, tabularNums]}>{r.mapNumber}</Text>
            <TextInput
              value={r.mapName}
              onChangeText={(v) => updateRow(r.mapNumber, { mapName: v })}
              placeholder="e.g. Ascent"
              placeholderTextColor={color.fillPlaceholder}
              style={styles.nameInput}
            />
            <TextInput
              value={r.homeScore}
              onChangeText={(v) => updateRow(r.mapNumber, { homeScore: v })}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={color.fillPlaceholder}
              style={[styles.scoreInput, r.tied && styles.invalidInput, tabularNums]}
            />
            <TextInput
              value={r.awayScore}
              onChangeText={(v) => updateRow(r.mapNumber, { awayScore: v })}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={color.fillPlaceholder}
              style={[styles.scoreInput, r.tied && styles.invalidInput, tabularNums]}
            />
            <View style={{ width: 70, alignItems: 'flex-end' }}>
              {rows.length > 1 && (
                <Pressable onPress={() => removeMap(r.mapNumber)}>
                  <Text style={styles.removeLabel}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>

      <Pressable onPress={addMap}>
        <Text style={styles.addMapLabel}>+ Add another map</Text>
      </Pressable>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  previewContent: { padding: 20, gap: 14 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  previewTeam: { flex: 1, fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.textPrimary },
  previewScore: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, color: color.textMuted, ...tabularNums },
  standingsNote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 12 },
  noteRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  publishedNote: { flex: 1, fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 17, color: color.verified },
  resetLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted, textAlign: 'center' },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  editHint: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  table: { borderWidth: 1, borderColor: color.hairline },
  tableHeaderRow: { flexDirection: 'row', gap: 12, padding: 10, paddingHorizontal: 14, backgroundColor: color.panel, borderBottomWidth: 1, borderBottomColor: color.hairline },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  tableRow: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.06)' },
  mapNumber: { width: 50, fontFamily: fontFamily.rajdhaniBold, fontSize: 16, color: color.textPrimary },
  nameInput: { flex: 1, height: 38, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontFamily: fontFamily.interRegular, fontSize: 13, paddingHorizontal: 10 },
  scoreInput: { width: 120, height: 38, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontFamily: fontFamily.rajdhaniBold, fontSize: 16, textAlign: 'center' },
  invalidInput: { backgroundColor: color.emberTint, borderColor: color.emberTintBorder },
  removeLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.06 * 10, color: color.ember },
  addMapLabel: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted },
});
