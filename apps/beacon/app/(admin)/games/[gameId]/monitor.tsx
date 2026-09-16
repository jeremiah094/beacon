import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ClipboardAPI from 'expo-clipboard';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminButton } from '../../../../components/admin/AdminButton';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useSession } from '../../../../lib/hooks/useSession';
import { LineupState, MonitorTeam, useAdvanceGamePhase, useDecideSubstitution, useMonitorGame, useSetLobbyCode } from '../../../../lib/api/adminMonitor';

// Reference: Beacon 14 Monitor Live Match.dc.html. Two deliberate
// departures from the source, both because Beacon's real integrations
// can't back what it shows:
//  - "IN LOBBY" reads UNKNOWN for every team, not just the two the mock
//    calls out — apexlegendsapi.com has no live custom-lobby-presence
//    endpoint, so there's no honest way to report any team as "in lobby"
//    or "not seen".
//  - "Message all captains" / "Message captain" are dropped — Beacon has
//    no in-app messaging. "MARK NO-SHOW" is dropped too; a no-show is
//    recorded as part of verifying results (screen 15), not here.
const PHASES = ['SCHEDULED', 'LOBBY OPEN', 'IN PROGRESS', 'COMPLETED'];
const PHASE_STATUS = ['scheduled', 'lobby_open', 'in_progress', 'completed'];

export default function MonitorLiveMatch() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { userId } = useSession();
  const { data: game, isLoading } = useMonitorGame(gameId);
  const advance = useAdvanceGamePhase(gameId);
  const decideSub = useDecideSubstitution(gameId);
  const setLobbyCode = useSetLobbyCode(gameId);

  const [filter, setFilter] = useState<'All' | 'Needs attention' | 'Ready'>('All');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading || !game) {
    return (
      <AdminShell active="live" breadcrumbs={[{ label: 'Live matches' }]} title="LOADING">
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      </AdminShell>
    );
  }

  const phaseIdx = Math.max(0, PHASE_STATUS.indexOf(game.status));
  const isCancelled = game.status === 'cancelled';
  const title = `MATCH ${game.roundNumber} · GAME ${game.gameNumber}`;

  const pendingSubs = game.teams.filter((t) => t.pendingSub);
  const lockedCount = game.teams.filter((t) => t.lineupState === 'locked').length;
  const notSetCount = game.teams.filter((t) => t.lineupState === 'not_set').length;

  const visible = game.teams.filter((t) => {
    if (filter === 'All') return true;
    const needsHelp = t.lineupState === 'sub_pending' || t.lineupState === 'not_set';
    return filter === 'Needs attention' ? needsHelp : !needsHelp;
  });

  const clockCritical = phaseIdx <= 1;
  const scheduledMs = new Date(game.scheduledAt).getTime();
  const diffSeconds = Math.round((scheduledMs - now) / 1000);
  const remaining = Math.max(0, diffSeconds);
  const elapsed = Math.max(0, -diffSeconds);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = clockCritical
    ? `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`
    : `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`;

  async function handleAdvance() {
    if (phaseIdx >= 3) {
      router.push(`/(admin)/games/${gameId}/verify` as any);
      return;
    }
    await advance.mutateAsync({ nextStatus: PHASE_STATUS[phaseIdx + 1], currentLobbyCode: game?.lobbyCode ?? null });
  }

  async function approveSub(t: MonitorTeam) {
    if (!t.pendingSub || !userId) return;
    await decideSub.mutateAsync({
      requestId: t.pendingSub.requestId,
      teamId: t.teamId,
      approve: true,
      adminId: userId,
      outProfileId: t.pendingSub.outProfileId,
      inProfileId: t.pendingSub.inProfileId,
    });
  }

  async function denySub(t: MonitorTeam) {
    if (!t.pendingSub || !userId) return;
    await decideSub.mutateAsync({ requestId: t.pendingSub.requestId, teamId: t.teamId, approve: false, adminId: userId });
  }

  async function copyCode() {
    if (!game?.lobbyCode) return;
    await ClipboardAPI.setStringAsync(game.lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function startEditCode() {
    setCodeInput(game?.lobbyCode ?? '');
    setEditingCode(true);
  }

  async function saveCode() {
    const code = codeInput.trim();
    if (!code) return;
    await setLobbyCode.mutateAsync(code);
    setEditingCode(false);
  }

  const codeChars = (game.lobbyCode ?? '·····').split('');

  return (
    <AdminShell
      active="live"
      activeLeagueId={game.leagueId}
      breadcrumbs={[
        { label: game.leagueName, href: `/(admin)/leagues/create?leagueId=${game.leagueId}` as any },
        { label: 'Live matches', href: `/(admin)/leagues/${game.leagueId}/schedule` as any },
        { label: `Match ${game.roundNumber} · Game ${game.gameNumber}` },
      ]}
      title={title}
      titleMeta={`${game.map ?? 'Map TBC'} · ${game.teams.length}-team lobby · trios`}
      actions={
        <AdminButton
          label={phaseIdx >= 3 ? 'Verify results →' : `Advance to ${PHASES[phaseIdx + 1]?.toLowerCase() ?? ''}`}
          variant={phaseIdx >= 3 ? 'secondary' : 'primary'}
          disabled={isCancelled || advance.isPending}
          onPress={handleAdvance}
        />
      }
      belowTopBar={
        <View style={styles.statusStrip}>
          <View style={{ gap: 11 }}>
            <Text style={styles.stripLabel}>GAME STATUS</Text>
            <View style={{ flexDirection: 'row' }}>
              {PHASES.map((label, i) => (
                <View key={label} style={{ flex: 1, gap: 7 }}>
                  <View style={{ height: 4, backgroundColor: i < phaseIdx ? color.hairlineStrong : i === phaseIdx ? color.ember : 'rgba(242,241,236,0.14)' }} />
                  <Text style={[styles.phaseLabel, { color: i === phaseIdx ? color.textPrimary : color.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.phaseNote}>
              {isCancelled
                ? 'This game was cancelled.'
                : phaseIdx === 0
                  ? 'Published. The lobby has not opened yet.'
                  : phaseIdx === 1
                    ? `Lobby open. Lineups ${game.lineupLockedAt ? 'locked' : 'lock at T-10m'} — no further changes without an organiser.`
                    : phaseIdx === 2
                      ? 'Game underway. Placement and kills are read from EA when the lobby closes.'
                      : 'Completed. Results are waiting to be verified.'}
            </Text>
          </View>

          <View style={styles.stripDivider} />

          <View style={{ gap: 8 }}>
            <Text style={[styles.stripLabel, { color: clockCritical ? color.ember : color.textMuted }]}>{clockCritical ? 'MATCH STARTS IN' : 'ELAPSED'}</Text>
            <Text style={[styles.clock, { color: clockCritical ? color.ember : color.textPrimary }, tabularNums]}>{clock}</Text>
          </View>

          <View style={styles.stripDivider} />

          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <Text style={styles.stripLabel}>LOBBY CODE</Text>
              {!editingCode && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {game.lobbyCode && (
                    <Pressable onPress={copyCode}>
                      <Text style={[styles.copyLabel, { color: copied ? color.verified : color.textMuted }]}>{copied ? 'COPIED' : 'COPY'}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={startEditCode}>
                    <Text style={styles.copyLabel}>{game.lobbyCode ? 'EDIT' : 'SET CODE'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
            {editingCode ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={codeInput}
                  onChangeText={setCodeInput}
                  placeholder="e.g. XKQ4R"
                  placeholderTextColor={color.fillPlaceholder}
                  autoCapitalize="none"
                  autoFocus
                  style={styles.codeInput}
                />
                <Pressable onPress={saveCode} disabled={setLobbyCode.isPending || !codeInput.trim()}>
                  <View style={styles.codeSaveBtn}>
                    <Text style={styles.codeSaveLabel}>Save</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => setEditingCode(false)}>
                  <Text style={styles.copyLabel}>CANCEL</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {codeChars.map((ch, i) => (
                  <View key={i} style={styles.codeBox}>
                    <Text style={styles.codeChar}>{ch}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      }
      rail={
        <>
          <Text style={styles.railTitle}>Needs attention</Text>

          {pendingSubs.map((t) => (
            <View key={t.teamId} style={styles.issueCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ gap: 4 }}>
                  <Text style={styles.issueName}>{t.name}</Text>
                  <Text style={styles.issueCaptain}>Captain {t.captainName}</Text>
                </View>
                <AdminChip label="SUB REQUEST" tone="ember" dotShape="circle" />
              </View>
              <Text style={styles.issueDetail}>
                Requested {t.pendingSub!.inName} in for {t.pendingSub!.outName}
                {t.pendingSub!.reason ? ` — ${t.pendingSub!.reason}` : ''}.
              </Text>
              <View style={styles.issueActions}>
                <AdminButton label="Approve substitution" height={40} disabled={decideSub.isPending} onPress={() => approveSub(t)} />
                <Pressable onPress={() => denySub(t)} disabled={decideSub.isPending}>
                  <View style={styles.denyBtn}>
                    <Text style={styles.denyLabel}>Deny</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ))}

          {pendingSubs.length === 0 && (
            <View style={styles.allClear}>
              <Diamond size={10} color={color.verified} />
              <Text style={styles.allClearTitle}>All clear</Text>
              <Text style={styles.allClearBody}>No substitution requests are open. Nothing needs an organiser right now.</Text>
            </View>
          )}

          <View style={styles.readinessCard}>
            <Text style={styles.readinessLabel}>READINESS</Text>
            <View style={{ gap: 6 }}>
              <View style={styles.readinessRow}>
                <Text style={styles.readinessK}>Lineups locked</Text>
                <Text style={[styles.readinessV, tabularNums]}>{lockedCount} / {game.teams.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {game.teams.map((t) => (
                  <View key={t.teamId} style={{ flex: 1, height: 5, backgroundColor: t.lineupState === 'locked' ? color.verified : t.lineupState === 'sub_pending' ? color.ember : 'rgba(242,241,236,0.2)' }} />
                ))}
              </View>
            </View>
            <Text style={styles.readinessNote}>
              {notSetCount > 0
                ? `${notSetCount} team${notSetCount === 1 ? '' : 's'} still ${notSetCount === 1 ? 'has' : 'have'} no lineup submitted.`
                : 'Every team has a lineup for this game.'}{' '}
              In-lobby presence isn't trackable through Beacon's Apex integration, so it isn't shown here.
            </Text>
          </View>

          {game.auditLog.length > 0 && (
            <View style={styles.readinessCard}>
              <Text style={styles.readinessLabel}>AUDIT LOG</Text>
              {game.auditLog.map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={[styles.logTime, tabularNums]}>{formatClockTime(l.at)}</Text>
                  <Text style={styles.logText}>{l.text}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <View style={{ gap: 5 }}>
          <Text style={styles.sectionLabel}>Team checklist</Text>
          <Text style={[styles.readyLine, tabularNums]}>
            {lockedCount} of {game.teams.length} lineups locked · {pendingSubs.length} needing an organiser
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['All', 'Needs attention', 'Ready'] as const).map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)}>
              <View style={[styles.filterChip, filter === f ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
                <Text style={[styles.filterChipLabel, filter === f && { color: color.base }]}>{f}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
      <View style={[styles.table, { minWidth: 640 }]}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: 30 }]}>#</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TEAM</Text>
          <Text style={[styles.tableHeaderCell, { width: 132 }]}>LINEUP</Text>
          <Text style={[styles.tableHeaderCell, { width: 148 }]}>IN LOBBY</Text>
          <Text style={[styles.tableHeaderCell, { width: 112, textAlign: 'right' }]}>ACTION</Text>
        </View>
        {visible.map((t, i) => {
          const needsHelp = t.lineupState === 'sub_pending';
          return (
            <View key={t.teamId} style={[styles.tableRow, needsHelp && { backgroundColor: color.panel, borderLeftWidth: 2, borderLeftColor: color.ember }]}>
              <Text style={[styles.rowIndex, tabularNums]}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={{ gap: 2, minWidth: 0 }}>
                <Text style={[styles.rowName, { color: needsHelp ? color.textPrimary : color.textMuted }]} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {t.pendingSub ? `Captain ${t.captainName} · requested ${t.pendingSub.inName}` : `Captain ${t.captainName}`}
                </Text>
              </View>
              <LineupPill state={t.lineupState} />
              <AdminChip label="UNKNOWN" tone="neutral" />
              <View style={{ width: 112, alignItems: 'flex-end' }}>
                {t.pendingSub && (
                  <Pressable onPress={() => approveSub(t)} disabled={decideSub.isPending}>
                    <View style={styles.rowActionBtn}>
                      <Text style={styles.rowActionLabel}>APPROVE SUB</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
      </ScrollView>

      <Text style={styles.footnote}>
        Lobby presence isn't trackable via Beacon's Apex integration, so every row reads unknown rather than assuming a team is absent.
      </Text>
    </AdminShell>
  );
}

function LineupPill({ state }: { state: LineupState }) {
  const cfg =
    state === 'locked'
      ? { label: 'LOCKED', tone: 'verified' as const }
      : state === 'sub_pending'
        ? { label: 'SUB PENDING', tone: 'ember' as const }
        : state === 'pending'
          ? { label: 'PENDING', tone: 'neutral' as const }
          : { label: 'NOT SET', tone: 'ember' as const };
  return <AdminChip label={cfg.label} tone={cfg.tone} />;
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  statusStrip: { paddingVertical: 18, paddingHorizontal: 28, borderBottomWidth: 1, borderBottomColor: color.hairline, backgroundColor: '#0E0F12', flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, gap: 24, alignItems: 'center' },
  stripLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.14 * 9, color: color.textMuted },
  phaseLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.06 * 9 },
  phaseNote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15, color: color.textMuted, ...tabularNums },
  stripDivider: { width: 1, alignSelf: 'stretch', backgroundColor: color.hairline },
  clock: { fontFamily: fontFamily.rajdhaniBold, fontSize: 40, lineHeight: 40 },
  copyLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.08 * 10 },
  codeBox: { flex: 1, height: 52, minWidth: 32, backgroundColor: color.panel, borderWidth: 1, borderColor: color.hairlineInput, alignItems: 'center', justifyContent: 'center' },
  codeChar: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26, letterSpacing: 0.04 * 26, color: color.textPrimary },
  codeInput: {
    height: 44,
    width: 140,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    color: color.textPrimary,
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 18,
    letterSpacing: 0.04 * 18,
    paddingHorizontal: 12,
  },
  codeSaveBtn: { height: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color.textPrimary },
  codeSaveLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.base },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  readyLine: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  filterChip: { paddingVertical: 8, paddingHorizontal: 13, borderWidth: 1 },
  filterChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textMuted },
  table: { borderWidth: 1, borderColor: color.hairline },
  tableHeaderRow: { flexDirection: 'row', gap: 12, padding: 10, paddingHorizontal: 14, backgroundColor: color.panel, borderBottomWidth: 1, borderBottomColor: color.hairline },
  tableHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  tableRow: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.06)' },
  rowIndex: { width: 30, fontFamily: fontFamily.rajdhaniBold, fontSize: 12, color: color.textMuted },
  rowName: { flex: 1, fontFamily: fontFamily.interSemiBold, fontSize: 13 },
  rowSub: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted },
  rowActionBtn: { paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: color.textPrimary, backgroundColor: color.textPrimary },
  rowActionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.06 * 10, color: color.base },
  footnote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted },
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  issueCard: { borderWidth: 1, borderColor: color.emberBorderStrong, backgroundColor: color.panel, padding: 17, gap: 12 },
  issueName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, letterSpacing: 0.01 * 17, color: color.textPrimary },
  issueCaptain: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  issueDetail: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  issueActions: { gap: 8, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 12 },
  denyBtn: { height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.neutralBorder },
  denyLabel: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted },
  allClear: { borderWidth: 1, borderColor: color.verifiedTintBorder, backgroundColor: color.panel, padding: 20, gap: 11, alignItems: 'flex-start' },
  allClearTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 20, lineHeight: 22, color: color.textPrimary },
  allClearBody: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 18, color: color.textMuted },
  readinessCard: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 17, gap: 12 },
  readinessLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  readinessRow: { flexDirection: 'row', justifyContent: 'space-between' },
  readinessK: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  readinessV: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textPrimary },
  readinessNote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 11 },
  logTime: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textPrimary, flex: 'none' as any },
  logText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15, color: color.textMuted },
});
