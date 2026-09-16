import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminButton } from '../../../../components/admin/AdminButton';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { AdminDateField } from '../../../../components/admin/AdminDateField';
import { AdminTallyRow } from '../../../../components/admin/AdminTally';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useAdminLeague } from '../../../../lib/api/adminLeagues';
import {
  AdminGame,
  GameFormData,
  useAdminGames,
  useApprovedTeamCount,
  useCancelGame,
  useSaveGame,
  useSetGameLobbyCode,
} from '../../../../lib/api/adminSchedule';

// Reference: Beacon 13 Schedule Matches.dc.html. The source lets the admin
// hand-pick which of 20 approved teams share a given lobby (a per-game
// roster). BUILD.md's schema has no such junction — every approved team
// plays every scheduled game, full stop — so that grid is replaced with a
// read-only "N teams approved" readout. Likewise the source's edit-row
// copy claims edits re-notify players; only games_notify_new_match (on
// INSERT) and lock_soon exist per BUILD.md §5, so editing here is silent
// and the rail says so rather than overclaiming.
const TIMES = ['19:00', '20:00', '21:00', '21:30'];
const MAPS = ['Storm Point', "World's Edge", 'Broken Moon', 'Olympus'];

export default function ScheduleMatches() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { data: league } = useAdminLeague(leagueId);
  const { data: games, isLoading } = useAdminGames(leagueId);
  const { data: approvedTeams } = useApprovedTeamCount(leagueId);
  const saveGame = useSaveGame(leagueId);
  const cancelGame = useCancelGame(leagueId);
  const setLobbyCode = useSetGameLobbyCode(leagueId);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [round, setRound] = useState('');
  const [gameNumber, setGameNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [map, setMap] = useState('Storm Point');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [justPublishedId, setJustPublishedId] = useState<string | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');

  const active = (games ?? []).filter((g) => g.status !== 'cancelled');

  function startEdit(g: AdminGame) {
    setEditingId(g.id);
    setJustPublishedId(null);
    setRound(String(g.roundNumber));
    setGameNumber(String(g.gameNumber));
    const d = new Date(g.scheduledAt);
    setDate(d.toISOString().slice(0, 10));
    setTime(d.toISOString().slice(11, 16));
    setMap(g.map ?? MAPS[0]);
  }

  function clearForm() {
    setEditingId(null);
    setRound('');
    setGameNumber('');
    setDate('');
    setJustPublishedId(null);
  }

  const missing: string[] = [];
  if (!round.trim()) missing.push('a match number');
  if (!gameNumber.trim()) missing.push('a game number');
  if (!date.trim()) missing.push('a date');
  const ready = missing.length === 0;
  let blockedReason = '';
  if (missing.length === 1) blockedReason = `Publishing needs ${missing[0]}.`;
  else if (missing.length > 1) blockedReason = `Publishing needs ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}.`;

  const scheduledAt = parseDateTime(date, time);

  async function publish() {
    if (!ready || !scheduledAt) return;
    const form: GameFormData = { roundNumber: Number(round), gameNumber: Number(gameNumber), scheduledAt, map };
    const id = await saveGame.mutateAsync({ gameId: editingId ?? undefined, form });
    if (editingId) {
      setEditingId(null);
    } else {
      setJustPublishedId(id);
    }
  }

  function startEditCode(g: AdminGame) {
    setEditingCodeId(g.id);
    setCodeInput(g.lobbyCode ?? '');
  }

  async function saveCode(gameId: string) {
    const code = codeInput.trim();
    if (!code) return;
    await setLobbyCode.mutateAsync({ gameId, lobbyCode: code });
    setEditingCodeId(null);
  }

  async function confirmCancel(gameId: string) {
    if (cancellingId === gameId) {
      await cancelGame.mutateAsync(gameId);
      setCancellingId(null);
      if (editingId === gameId) setEditingId(null);
    } else {
      setCancellingId(gameId);
    }
  }

  const title = `Match ${round || '—'} · Game ${gameNumber || '—'}`;
  const whenText = `${date || 'date not set'} · ${time}`;
  const players = (approvedTeams ?? 0) * 3;
  const published = !!justPublishedId && !editingId;

  return (
    <AdminShell
      active="schedule"
      activeLeagueId={leagueId}
      breadcrumbs={[
        { label: 'Leagues', href: '/(admin)/leagues' },
        { label: league?.name ?? 'League', href: `/(admin)/leagues/create?leagueId=${leagueId}` as any },
        { label: 'Schedule' },
      ]}
      title="SCHEDULE MATCHES"
      actions={
        <AdminTallyRow
          items={[
            { n: active.length, label: 'SCHEDULED' },
            { n: approvedTeams ?? 0, label: 'TEAMS ELIGIBLE', fg: color.verified },
          ]}
        />
      }
      rail={
        <>
          <Text style={styles.railTitle}>{editingId ? 'Editing scheduled game' : published ? 'Published to players' : 'Publish preview'}</Text>

          <CornerCut cut={20} fill={color.panel} strokeColor={published ? color.verifiedTintBorder : color.hairline}>
            <View style={styles.previewContent}>
              <AdminChip
                label={editingId ? 'EDITING' : published ? 'SCHEDULED · PLAYERS NOTIFIED' : 'NOT YET VISIBLE'}
                tone={published ? 'verified' : 'neutral'}
                dotShape="circle"
              />
              <Text style={styles.previewTitle}>{title}</Text>
              <View style={styles.previewSummary}>
                {[
                  ['League', league?.name ?? '—'],
                  ['When', whenText],
                  ['Map', map],
                  ['Format', 'Battle royale · trios'],
                  ['Teams', `${approvedTeams ?? 0} approved`],
                ].map(([k, v]) => (
                  <View key={k} style={styles.summaryRow}>
                    <Text style={styles.summaryK}>{k}</Text>
                    <Text style={styles.summaryV}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </CornerCut>

          {editingId ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>EDITING AN EXISTING GAME</Text>
              <Text style={styles.infoBody}>Saving changes updates the game in place. No new notification is sent — only creating a game or the T-10m lock does that.</Text>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>PUBLISHING SENDS THIS</Text>
              <View style={styles.pushPreview}>
                <View style={styles.pushIcon}>
                  <Diamond size={12} color={color.textPrimary} />
                </View>
                <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
                  <Text style={styles.pushTitle}>New game scheduled</Text>
                  <Text style={styles.pushBody}>
                    {league?.name ?? 'Your league'} added {title} — {whenText}, {map}. {approvedTeams ?? 0}-team lobby.
                  </Text>
                </View>
              </View>
              <Text style={styles.notifyLine}>
                {(approvedTeams ?? 0) > 0
                  ? `Publishing notifies ${players} players across ${approvedTeams} teams immediately. There is no quiet publish — if the time is wrong, fix it before you publish rather than after.`
                  : 'No teams are approved yet, so this publishes with an empty lobby. Every team you approve afterward on Team approvals plays it — there’s no separate step to add them to this game.'}
              </Text>
            </View>
          )}

          {!published && !ready && (
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>{blockedReason}</Text>
            </View>
          )}

          <AdminButton
            label={editingId ? 'Save changes' : published ? 'Schedule published' : 'Publish schedule'}
            height={52}
            disabled={published || !ready || saveGame.isPending}
            onPress={publish}
          />

          {published && (
            <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
              <Diamond size={9} color={color.verified} style={{ marginTop: 4 }} />
              <Text style={styles.publishedNote}>
                Sent to {players} players. The game now appears in their Upcoming games, and lineups lock 10 minutes before {time}.
              </Text>
            </View>
          )}

          <Pressable onPress={clearForm}>
            <Text style={styles.resetLabel}>{editingId ? 'Cancel edit' : published ? 'Schedule another game' : 'Clear form'}</Text>
          </Pressable>
        </>
      }
    >
      <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
        <Field label="Match" style={isMobile ? { width: '100%' } : { width: 110 }}>
          <TextInput value={round} onChangeText={(v) => { setRound(v); setJustPublishedId(null); }} placeholder="10" placeholderTextColor={color.fillPlaceholder} keyboardType="number-pad" style={[styles.input, tabularNums]} />
        </Field>
        <Field label="Game" style={isMobile ? { width: '100%' } : { flex: 1 }}>
          <TextInput value={gameNumber} onChangeText={(v) => { setGameNumber(v); setJustPublishedId(null); }} placeholder="1" placeholderTextColor={color.fillPlaceholder} keyboardType="number-pad" style={[styles.input, tabularNums]} />
        </Field>
        <Field label="Date" style={isMobile ? { width: '100%' } : { flex: 1 }}>
          <AdminDateField value={date} onChange={(v) => { setDate(v); setJustPublishedId(null); }} style={tabularNums} />
        </Field>
        <Field label="Lobby opens" style={isMobile ? { width: '100%' } : { flex: 1.2 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TIMES.map((t) => (
              <Pressable key={t} style={{ flex: 1 }} onPress={() => { setTime(t); setJustPublishedId(null); }}>
                <View style={[styles.timeChip, time === t ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
                  <Text style={[styles.timeChipLabel, time === t && { color: color.base }, tabularNums]}>{t}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Field>
      </View>

      <Field label="Map">
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {MAPS.map((m) => (
            <Pressable key={m} onPress={() => { setMap(m); setJustPublishedId(null); }}>
              <View style={[styles.mapChip, map === m ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
                <Text style={[styles.mapChipLabel, map === m && { color: color.base }]}>{m}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Field>

      <View style={styles.eligibleBox}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={styles.eligibleLabel}>TEAMS IN THIS LOBBY</Text>
          <Text style={styles.eligibleBody}>Every approved team plays every scheduled game — there's no per-match roster to pick.</Text>
        </View>
        <Text style={[styles.eligibleCount, tabularNums]}>{approvedTeams ?? 0}</Text>
      </View>

      <View style={styles.scheduledSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
          <Text style={styles.sectionLabel}>Already scheduled</Text>
          <Text style={styles.sectionHint}>Edit or cancel</Text>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Spinner size={20} />
          </View>
        ) : active.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyBody}>No games scheduled yet. Fill the form above and publish the first one.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
          <View style={[styles.table, { minWidth: 820 }]}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { width: 150 }]}>GAME</Text>
              <Text style={[styles.tableHeaderCell, { width: 150 }]}>LOBBY CODE</Text>
              <Text style={[styles.tableHeaderCell, { width: 130 }]}>WHEN</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>MAP</Text>
              <Text style={[styles.tableHeaderCell, { width: 176, textAlign: 'right' }]}>ACTIONS</Text>
            </View>
            {(games ?? []).map((g) => {
              const cancelled = g.status === 'cancelled';
              const live = g.status === 'in_progress' || g.status === 'lobby_open';
              const editable = g.status === 'scheduled';
              const fg = cancelled ? color.textMuted : color.textPrimary;
              const stateLabel = cancelled ? 'CANCELLED' : g.status === 'in_progress' ? 'LIVE' : g.status === 'lobby_open' ? 'LOBBY OPEN' : 'SCHEDULED';
              return (
                <View key={g.id} style={[styles.tableRow, live && { backgroundColor: color.panel }]}>
                  <View style={{ width: 150, gap: 3 }}>
                    <Text style={[styles.rowTitle, { color: fg }]}>Match {g.roundNumber} · Game {g.gameNumber}</Text>
                    <Text style={[styles.rowState, { color: cancelled ? color.textMuted : live ? color.ember : color.textMuted }]}>{stateLabel}</Text>
                  </View>
                  <View style={{ width: 150 }}>
                    {editingCodeId === g.id ? (
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <TextInput
                          value={codeInput}
                          onChangeText={setCodeInput}
                          placeholder="e.g. XKQ4R"
                          placeholderTextColor={color.fillPlaceholder}
                          autoCapitalize="none"
                          autoFocus
                          style={styles.codeInput}
                        />
                        <Pressable onPress={() => saveCode(g.id)} disabled={setLobbyCode.isPending || !codeInput.trim()}>
                          <Text style={styles.codeSaveLabel}>Save</Text>
                        </Pressable>
                        <Pressable onPress={() => setEditingCodeId(null)}>
                          <Text style={styles.codeCancelLabel}>✕</Text>
                        </Pressable>
                      </View>
                    ) : cancelled ? (
                      <Text style={[styles.rowCode, { color: color.textMuted }]}>{g.lobbyCode ?? '—'}</Text>
                    ) : (
                      <Pressable onPress={() => startEditCode(g)}>
                        {({ hovered }: any) => (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.rowCode, { color: g.lobbyCode ? fg : color.textMuted }]}>{g.lobbyCode ?? 'Not set'}</Text>
                            <Text style={[styles.codeEditHint, hovered && { color: color.textPrimary }]}>{g.lobbyCode ? 'Edit' : 'Set'}</Text>
                          </View>
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Text style={[styles.rowWhen, { color: fg }, tabularNums]}>{formatGameWhen(g.scheduledAt)}</Text>
                  <Text style={styles.rowMap}>{g.map ?? '—'}</Text>
                  <View style={{ width: 176, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                    {live && (
                      <Pressable onPress={() => router.push(`/(admin)/games/${g.id}/monitor` as any)}>
                        <AdminChip label="MONITOR" tone="ember" dotShape="circle" />
                      </Pressable>
                    )}
                    {editable && (
                      <>
                        <Pressable onPress={() => startEdit(g)}>
                          <View style={styles.editBtn}>
                            <Text style={styles.editBtnLabel}>Edit</Text>
                          </View>
                        </Pressable>
                        <Pressable onPress={() => confirmCancel(g.id)}>
                          <View style={[styles.cancelBtn, cancellingId === g.id && { backgroundColor: color.emberTint }]}>
                            <Text style={styles.cancelBtnLabel}>{cancellingId === g.id ? 'Confirm cancel' : 'Cancel'}</Text>
                          </View>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          </ScrollView>
        )}
      </View>
    </AdminShell>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 9 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function parseDateTime(date: string, time: string): string | null {
  if (!date.trim() || !time.trim()) return null;
  const d = new Date(`${date}T${time}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatGameWhen(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${timePart}`;
}

const styles = StyleSheet.create({
  formRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' },
  formRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  fieldLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  input: { height: 46, backgroundColor: color.panel, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontSize: 15, paddingHorizontal: 14, fontFamily: fontFamily.interRegular },
  timeChip: { height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  timeChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textMuted },
  mapChip: { paddingVertical: 13, paddingHorizontal: 18, borderWidth: 1 },
  mapChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textMuted },
  eligibleBox: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 16 },
  eligibleLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  eligibleBody: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15.5, color: color.textMuted },
  eligibleCount: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, color: color.verified },
  scheduledSection: { gap: 12, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 22 },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  sectionHint: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 24 },
  emptyBody: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted },
  table: { borderWidth: 1, borderColor: color.hairline },
  tableHeaderRow: { flexDirection: 'row', gap: 14, padding: 11, paddingHorizontal: 16, backgroundColor: color.panel, borderBottomWidth: 1, borderBottomColor: color.hairline },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  tableRow: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.08)' },
  rowTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 14, letterSpacing: 0.02 * 14 },
  rowState: { fontFamily: fontFamily.interRegular, fontSize: 9, letterSpacing: 0.1 * 9 },
  rowWhen: { width: 130, fontFamily: fontFamily.interMedium, fontSize: 12 },
  rowCode: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 14, letterSpacing: 0.03 * 14 },
  codeEditHint: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.06 * 10, color: color.textMuted },
  codeInput: {
    height: 32,
    width: 84,
    backgroundColor: color.base,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    color: color.textPrimary,
    fontFamily: fontFamily.rajdhaniSemiBold,
    fontSize: 13,
    paddingHorizontal: 8,
  },
  codeSaveLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textPrimary },
  codeCancelLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  rowMap: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  editBtn: { paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: color.hairlineStrong },
  editBtnLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textPrimary },
  cancelBtn: { paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: color.emberBorderStrong },
  cancelBtnLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.ember },
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  previewContent: { padding: 20, gap: 15 },
  previewTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 24, lineHeight: 25, color: color.textPrimary },
  previewSummary: { gap: 10, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  summaryK: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  summaryV: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textPrimary, textAlign: 'right', ...tabularNums },
  infoBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 18, gap: 13 },
  infoLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  infoBody: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 18, color: color.textMuted },
  pushPreview: { borderWidth: 1, borderColor: color.hairlineInput, backgroundColor: color.base, padding: 13, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  pushIcon: { width: 30, height: 30, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  pushTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  pushBody: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15.5, color: color.textMuted },
  notifyLine: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  noteRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  publishedNote: { flex: 1, fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 17, color: color.verified },
  resetLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted, textAlign: 'center' },
});
