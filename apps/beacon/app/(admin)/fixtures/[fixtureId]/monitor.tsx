import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ClipboardAPI from 'expo-clipboard';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminButton } from '../../../../components/admin/AdminButton';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { formatCountdownDHMS } from '../../../../lib/time';
import { FixtureSide, useAdvanceFixturePhase, useMonitorFixture, useSetMonitorFixtureLobbyCode } from '../../../../lib/api/adminFixtureMonitor';

const PHASES = ['SCHEDULED', 'LINEUP LOCK', 'LIVE', 'COMPLETED'];
const PHASE_STATUS = ['scheduled', 'lineup_lock', 'live', 'completed'];

// Head-to-head equivalent of games/[gameId]/monitor.tsx. Simpler than the
// Apex monitor on purpose — a fixture has two sides, not 20 teams, and no
// in-lobby checklist (lobby_presence is keyed to games, not fixtures) or
// substitution flow for fixture_lineups yet, so this is a focused
// live-watch screen: phase, clock, lobby code, observer stream, and each
// side's starting-5 readiness plus the live map score.
export default function MonitorFixture() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { data: fixture, isLoading } = useMonitorFixture(fixtureId);
  const advance = useAdvanceFixturePhase(fixtureId);
  const setLobbyCode = useSetMonitorFixtureLobbyCode(fixtureId);

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading || !fixture) {
    return (
      <AdminShell active="live" breadcrumbs={[{ label: 'Live matches' }]} title="LOADING">
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      </AdminShell>
    );
  }

  const phaseIdx = Math.max(0, PHASE_STATUS.indexOf(fixture.status));
  const isCancelled = fixture.status === 'cancelled';
  const title = `${fixture.home.teamName} vs ${fixture.away.teamName}`;

  const clockCritical = phaseIdx <= 1;
  const scheduledMs = new Date(fixture.scheduledAt).getTime();
  const diffSeconds = Math.round((scheduledMs - now) / 1000);
  const remaining = Math.max(0, diffSeconds);
  const elapsed = Math.max(0, -diffSeconds);
  const clock = formatCountdownDHMS(clockCritical ? remaining : elapsed);

  async function handleAdvance() {
    if (phaseIdx >= 2) {
      router.push(`/(admin)/fixtures/${fixtureId}/verify` as any);
      return;
    }
    await advance.mutateAsync({ nextStatus: PHASE_STATUS[phaseIdx + 1] });
  }

  async function copyCode() {
    if (!fixture?.lobbyCode) return;
    await ClipboardAPI.setStringAsync(fixture.lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function startEditCode() {
    setCodeInput(fixture?.lobbyCode ?? '');
    setEditingCode(true);
  }

  async function saveCode() {
    const code = codeInput.trim();
    if (!code) return;
    await setLobbyCode.mutateAsync(code);
    setEditingCode(false);
  }

  async function clearCode() {
    await setLobbyCode.mutateAsync(null);
    setEditingCode(false);
  }

  const codeChars = (fixture.lobbyCode ?? '·····').split('');

  return (
    <AdminShell
      active="live"
      activeLeagueId={fixture.leagueId}
      breadcrumbs={[
        { label: fixture.leagueName, href: `/(admin)/leagues/create?leagueId=${fixture.leagueId}` as any },
        { label: 'Schedule', href: `/(admin)/leagues/${fixture.leagueId}/schedule` as any },
        { label: title },
      ]}
      title="MONITOR SERIES"
      titleMeta={`${title} · Bo${fixture.bestOf} · Round ${fixture.roundNumber}`}
      actions={
        <AdminButton
          label={phaseIdx >= 2 ? 'Enter scores →' : `Advance to ${PHASES[phaseIdx + 1]?.toLowerCase() ?? ''}`}
          variant={phaseIdx >= 2 ? 'secondary' : 'primary'}
          disabled={isCancelled || advance.isPending}
          onPress={handleAdvance}
        />
      }
      belowTopBar={
        <View style={styles.statusStrip}>
          <View style={{ gap: 11 }}>
            <Text style={styles.stripLabel}>SERIES STATUS</Text>
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
                ? 'This fixture was cancelled.'
                : phaseIdx === 0
                  ? 'Published. Starting 5s are open for both captains.'
                  : phaseIdx === 1
                    ? `Starting 5s ${fixture.lineupLockedAt ? 'locked' : 'lock at T-10m'} — no further changes without an organiser.`
                    : phaseIdx === 2
                      ? 'Series underway. Enter each map score as it finishes.'
                      : 'Completed. Result is published to standings.'}
            </Text>
          </View>

          <View style={styles.stripDivider} />

          <View style={{ gap: 8 }}>
            <Text style={[styles.stripLabel, { color: clockCritical ? color.ember : color.textMuted }]}>{clockCritical ? 'SERIES STARTS IN' : 'ELAPSED'}</Text>
            <Text style={[styles.clock, { color: clockCritical ? color.ember : color.textPrimary }, tabularNums]}>{clock}</Text>
          </View>

          <View style={styles.stripDivider} />

          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <Text style={styles.stripLabel}>LOBBY CODE</Text>
              {!editingCode && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {fixture.lobbyCode && (
                    <Pressable onPress={copyCode}>
                      <Text style={[styles.copyLabel, { color: copied ? color.verified : color.textMuted }]}>{copied ? 'COPIED' : 'COPY'}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={startEditCode}>
                    <Text style={styles.copyLabel}>{fixture.lobbyCode ? 'EDIT' : 'SET CODE'}</Text>
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
                {fixture.lobbyCode && (
                  <Pressable onPress={clearCode} disabled={setLobbyCode.isPending}>
                    <Text style={[styles.copyLabel, { color: color.ember }]}>CLEAR</Text>
                  </Pressable>
                )}
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

          <View style={styles.stripDivider} />

          <View style={{ gap: 9 }}>
            <Text style={[styles.stripLabel, { color: fixture.streamLive ? color.ember : color.textMuted }]}>OBSERVER STREAM</Text>
            {!fixture.observerId ? (
              <Text style={styles.streamOfflineText}>No observer assigned</Text>
            ) : !fixture.observerTwitchLogin ? (
              <Text style={styles.streamOfflineText}>{fixture.observerName} hasn't connected Twitch</Text>
            ) : fixture.streamLive ? (
              <Pressable onPress={() => Linking.openURL(`https://twitch.tv/${fixture.observerTwitchLogin}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.liveDot} />
                  <Text style={styles.streamLiveText}>{fixture.streamViewers ?? 0} watching · Watch →</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.streamOfflineText}>{fixture.observerName} · offline</Text>
            )}
          </View>
        </View>
      }
      rail={
        <>
          <Text style={styles.railTitle}>Live score</Text>
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreTeamName} numberOfLines={1}>{fixture.home.teamName}</Text>
              <Text style={[styles.scoreValue, fixture.homeMapsWon > fixture.awayMapsWon && { color: color.verified }, tabularNums]}>{fixture.homeMapsWon}</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreTeamName} numberOfLines={1}>{fixture.away.teamName}</Text>
              <Text style={[styles.scoreValue, fixture.awayMapsWon > fixture.homeMapsWon && { color: color.verified }, tabularNums]}>{fixture.awayMapsWon}</Text>
            </View>
            <Text style={styles.scoreNote}>First to a map majority of Bo{fixture.bestOf} wins the series.</Text>
          </View>
        </>
      }
    >
      <Text style={styles.sectionLabel}>Starting 5 readiness</Text>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <SideCard side={fixture.home} />
        <SideCard side={fixture.away} />
      </View>

      <Text style={styles.footnote}>
        Starting 5s are set by each captain from the app and locked automatically 10 minutes before the series starts — there's no admin
        override here yet beyond assigning an observer and the lobby code above.
      </Text>
    </AdminShell>
  );
}

function SideCard({ side }: { side: FixtureSide }) {
  const ready = side.starters.length >= 5;
  return (
    <View style={styles.sideCard}>
      <View style={styles.sideHeaderRow}>
        <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <Text style={styles.sideTeamName} numberOfLines={1}>{side.teamName}</Text>
          <Text style={styles.sideCaptain}>Captain {side.captainName}</Text>
        </View>
        <AdminChip label={ready ? 'LOCKED IN' : `${side.starters.length} / 5`} tone={ready ? 'verified' : 'neutral'} dotShape={ready ? 'diamond' : 'circle'} />
      </View>
      {side.starters.length > 0 ? (
        <View style={{ gap: 6 }}>
          {side.starters.map((p) => (
            <View key={p.profileId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Diamond size={6} color={color.verified} />
              <Text style={styles.starterName}>{p.name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.sideEmpty}>No starting 5 submitted yet.</Text>
      )}
    </View>
  );
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
  streamOfflineText: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  streamLiveText: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.ember },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.ember },
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
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  scoreCard: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 17, gap: 10 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  scoreTeamName: { flex: 1, fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  scoreValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, color: color.textMuted, ...tabularNums },
  scoreNote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 11, marginTop: 4 },
  sideCard: { flex: 1, minWidth: 260, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 17, gap: 13 },
  sideHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sideTeamName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, letterSpacing: 0.01 * 17, color: color.textPrimary },
  sideCaptain: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  starterName: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textPrimary },
  sideEmpty: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  footnote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16, color: color.textMuted },
});
