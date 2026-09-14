import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useSession } from '../../../../lib/hooks/useSession';
import { RosterPlayer, useRequestSubstitution, useTeamLineup } from '../../../../lib/api/lineup';

// Reference: Beacon 06 Lineup Locked.dc.html
export default function LineupLocked() {
  const { teamId } = useLocalSearchParams<{ gameId: string; teamId: string }>();
  const { userId } = useSession();
  const { data, isLoading } = useTeamLineup(teamId);
  const requestSub = useRequestSubstitution(teamId);

  const [requestOpen, setRequestOpen] = useState(false);
  const [pickedOut, setPickedOut] = useState<string | null>(null);
  const [pickedIn, setPickedIn] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
      </SafeAreaView>
    );
  }

  const starters = data.roster.filter((p) => data.selectedProfileIds.includes(p.profileId));
  const bench = data.roster.filter((p) => !data.selectedProfileIds.includes(p.profileId));

  const requestClosed = !requestOpen && !data.pendingSubRequest;
  const requestSent = !!data.pendingSubRequest;

  async function handleSend() {
    if (!pickedOut || !pickedIn || !data!.gameId || !userId) return;
    await requestSub.mutateAsync({ gameId: data!.gameId, outProfileId: pickedOut, inProfileId: pickedIn, requestedBy: userId });
    setRequestOpen(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.teamName}>{data.teamName.toUpperCase()}</Text>
            <Text style={styles.headerMeta}>
              {data.roster.length} / 5 roster{data.leagueName ? ` · ${data.leagueName}` : ''}
            </Text>
          </View>
          <View style={styles.lockedChip}>
            <View style={styles.lockedChipIcon} />
            <Text style={styles.lockedChipLabel}>LOCKED</Text>
          </View>
        </View>

        {data.gameId && (
          <>
            <View style={styles.nextGameBox}>
              <View style={{ gap: 5 }}>
                <Text style={styles.nextGameLabel}>LINEUP FOR</Text>
                <Text style={styles.nextGameTitle}>
                  Round {data.roundNumber} · Match {data.gameNumber}
                </Text>
                <Text style={styles.nextGameMeta}>{data.scheduledAt ? formatWhen(data.scheduledAt) : ''} · 20-team lobby · trios</Text>
              </View>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <Text style={[styles.selectedCount, tabularNums]}>3 / 3</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={styles.pip} />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.lockMetaRow}>
              <Text style={styles.lockMetaText}>Locked {data.lockAt ? formatClock(data.lockAt) : ''} · 10 min before lobby</Text>
              <Text style={styles.lockMetaText}>Changes closed</Text>
            </View>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.rosterHeaderRow}>
          <Text style={styles.sectionLabel}>Starting trio</Text>
          <Text style={styles.hint}>Read-only</Text>
        </View>

        {starters.map((p) => (
          <StarterRow key={p.profileId} player={p} />
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Not playing</Text>
        {bench.map((p) => (
          <BenchRow key={p.profileId} player={p} />
        ))}

        <CornerCut cut={18} fill={color.panel} strokeColor={color.hairline} style={{ marginTop: 8 }}>
          <View style={styles.explainContent}>
            <Text style={styles.explainTitle}>Why it's closed</Text>
            <Text style={styles.explainBody}>
              Lineups lock 10 minutes before the lobby opens so both teams enter on the same information. Nobody,
              including you, can swap a player after that point.
            </Text>
            <Text style={styles.explainBody}>
              If a player can't make it, a league admin can approve an emergency substitution from your bench.
              Requests are logged against the match record.
            </Text>

            {requestClosed && (
              <Pressable onPress={() => setRequestOpen(true)}>
                {({ pressed, hovered }: any) => (
                  <View style={[styles.requestButton, (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted }]}>
                    <Text style={styles.requestButtonLabel}>Request emergency substitution</Text>
                  </View>
                )}
              </Pressable>
            )}

            {requestOpen && !data.pendingSubRequest && (
              <View style={styles.subPickerBlock}>
                <Text style={styles.subPickerLabel}>OUT</Text>
                {starters.map((p) => (
                  <SubOption key={p.profileId} label={p.name} sub="Starter" selected={pickedOut === p.profileId} onPress={() => setPickedOut(p.profileId)} />
                ))}
                <Text style={styles.subPickerLabel}>SUB IN FROM BENCH</Text>
                {bench.map((p) => (
                  <SubOption
                    key={p.profileId}
                    label={p.name}
                    sub={p.eligible ? (pickedIn === p.profileId ? 'Selected' : 'Available') : 'Not eligible'}
                    selected={pickedIn === p.profileId}
                    disabled={!p.eligible}
                    onPress={() => p.eligible && setPickedIn(p.profileId)}
                  />
                ))}
                <Pressable onPress={handleSend} disabled={!pickedOut || !pickedIn || requestSub.isPending}>
                  {({ pressed, hovered }: any) => (
                    <View
                      style={[
                        styles.sendButton,
                        pickedOut && pickedIn
                          ? (pressed || hovered) && { backgroundColor: color.fillHover }
                          : { backgroundColor: color.fillMuted, borderColor: color.fillMutedBorder },
                      ]}
                    >
                      {requestSub.isPending ? (
                        <Spinner size={12} strokeColor={color.base} />
                      ) : (
                        <Text style={[styles.sendButtonLabel, !(pickedOut && pickedIn) && { color: 'rgba(242,241,236,0.35)' }]}>
                          {pickedOut && pickedIn ? 'Send request to admin' : 'Pick a bench player first'}
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
                <Pressable onPress={() => { setRequestOpen(false); setPickedOut(null); setPickedIn(null); }}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
              </View>
            )}

            {requestSent && data.pendingSubRequest && (
              <View style={styles.sentBlock}>
                <Diamond size={8} color={color.verified} />
                <View style={{ gap: 6, flex: 1 }}>
                  <Text style={styles.sentTitle}>
                    {data.pendingSubRequest.status === 'pending'
                      ? 'Request sent to the league admin'
                      : data.pendingSubRequest.status === 'approved'
                        ? 'Substitution approved'
                        : 'Substitution declined'}
                  </Text>
                  <Text style={styles.sentDetail}>
                    {data.roster.find((p) => p.profileId === data.pendingSubRequest!.inProfileId)?.name ?? 'Player'} requested as a
                    substitute. The admin decides and confirms before the lobby opens; you'll get a push either way.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </CornerCut>
      </ScrollView>

      <View style={styles.dockedFooter}>
        <View style={styles.confirmedDisabled}>
          <View style={styles.confirmedDisabledIcon} />
          <Text style={styles.confirmedDisabledLabel}>Lineup confirmed</Text>
        </View>
        {data.gameId && (
          <Pressable onPress={() => router.push({ pathname: '/(player)/games/[gameId]/lobby', params: { gameId: data.gameId! } } as any)}>
            <Text style={styles.lobbyLink}>Go to match lobby</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function StarterRow({ player }: { player: RosterPlayer }) {
  return (
    <CornerCut cut={14} fill={color.panel} strokeColor={color.hairline}>
      <View style={styles.starterContent}>
        <View style={styles.starterAvatar}>
          <Text style={styles.starterAvatarLabel}>{player.initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={styles.starterName}>{player.name}</Text>
            <Diamond size={8} color={color.verified} />
          </View>
          <Text style={styles.starterMeta}>{player.meta}</Text>
        </View>
        <View style={{ gap: 7, alignItems: 'flex-end' }}>
          <View style={styles.roleChip}>
            <Text style={styles.roleChipLabel}>{player.role.toUpperCase()}</Text>
          </View>
          <View style={styles.lockedInRow}>
            <Diamond size={7} color={color.verified} />
            <Text style={styles.lockedInLabel}>LOCKED IN</Text>
          </View>
        </View>
      </View>
    </CornerCut>
  );
}

function BenchRow({ player }: { player: RosterPlayer }) {
  return (
    <View style={styles.benchRow}>
      <View style={styles.benchAvatar}>
        <Text style={styles.benchAvatarLabel}>{player.initials}</Text>
      </View>
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <Text style={styles.benchName}>{player.name}</Text>
        <Text style={styles.benchMeta}>
          {player.meta} · {player.eligible ? 'available' : 'not eligible'}
        </Text>
      </View>
      <View style={styles.roleChipMuted}>
        <Text style={styles.roleChipLabel}>{player.role.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function SubOption({
  label,
  sub,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <View
        style={[
          styles.subOption,
          { borderColor: selected ? color.textPrimary : color.hairlineInput, backgroundColor: selected ? color.fillMuted : 'transparent' },
        ]}
      >
        <Text style={[styles.subOptionLabel, { color: disabled ? color.textMuted : color.textPrimary }]}>{label}</Text>
        <Text style={styles.subOptionSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const isToday = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return isToday ? `Tonight ${time}` : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 22, paddingBottom: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  back: { fontSize: 18, color: color.textMuted, paddingTop: 5 },
  teamName: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, letterSpacing: 0.01 * 28, color: color.textPrimary },
  headerMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  lockedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 5, paddingHorizontal: 8, marginTop: 3 },
  lockedChipIcon: { width: 8, height: 8, borderWidth: 1, borderColor: color.textPrimary },
  lockedChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textPrimary },
  nextGameBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: 14,
    paddingHorizontal: 16,
  },
  nextGameLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  nextGameTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, color: color.textPrimary },
  nextGameMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  selectedCount: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26, color: color.textPrimary },
  pip: { width: 16, height: 4, backgroundColor: color.textPrimary },
  lockMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lockMetaText: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  list: { padding: 22, paddingTop: 16, gap: 10 },
  rosterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, textTransform: 'uppercase', color: color.textMuted },
  hint: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  starterContent: { padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  starterAvatar: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(242,241,236,0.3)', alignItems: 'center', justifyContent: 'center' },
  starterAvatarLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13, color: color.textPrimary },
  starterName: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.textPrimary },
  starterMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  roleChip: { borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 3, paddingHorizontal: 6 },
  roleChipMuted: { borderWidth: 1, borderColor: color.hairlineInput, paddingVertical: 3, paddingHorizontal: 6 },
  roleChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  lockedInRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockedInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.1 * 9, color: color.verified },
  benchRow: { borderWidth: 1, borderColor: 'rgba(242,241,236,0.1)', backgroundColor: color.base, padding: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  benchAvatar: { width: 32, height: 32, borderWidth: 1, borderColor: color.hairlineInput, alignItems: 'center', justifyContent: 'center' },
  benchAvatarLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 12, color: color.textMuted },
  benchName: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textMuted },
  benchMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  explainContent: { padding: 18, gap: 14 },
  explainTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, letterSpacing: 0.02 * 17, color: color.textPrimary },
  explainBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19.5, color: color.textMuted },
  requestButton: { height: 44, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  requestButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  subPickerBlock: { gap: 12, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 14 },
  subPickerLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  subOption: { borderWidth: 1, paddingVertical: 11, paddingHorizontal: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  subOptionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13 },
  subOptionSub: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  sendButton: { height: 44, backgroundColor: color.textPrimary, alignItems: 'center', justifyContent: 'center' },
  sendButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.base },
  cancelLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted, textAlign: 'center' },
  sentBlock: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 14 },
  sentTitle: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.verified },
  sentDetail: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26, gap: 12, borderTopWidth: 1, borderTopColor: color.hairline },
  confirmedDisabled: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: color.fillMuted,
    borderWidth: 1,
    borderColor: color.fillMutedBorder,
  },
  confirmedDisabledIcon: { width: 9, height: 9, borderWidth: 1, borderColor: 'rgba(242,241,236,0.45)' },
  confirmedDisabledLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: 'rgba(242,241,236,0.45)' },
  lobbyLink: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.verified, textAlign: 'center' },
});
