import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useSession } from '../../../../lib/hooks/useSession';
import { RosterPlayer, useSetLineup, useTeamLineup } from '../../../../lib/api/lineup';

// Reference: Beacon 05 Roster Lineup.dc.html
export default function RosterLineup() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { userId } = useSession();
  const { data, isLoading } = useTeamLineup(teamId);
  const setLineup = useSetLineup(teamId);

  const [selected, setSelected] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setSelected(data.selectedProfileIds);
      setInitialized(true);
    }
  }, [data, initialized]);

  useEffect(() => {
    if (data?.isLocked && data.gameId) {
      router.replace({ pathname: '/(player)/games/[gameId]/locked', params: { gameId: data.gameId, teamId } } as any);
    }
  }, [data?.isLocked, data?.gameId, teamId]);

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
      </SafeAreaView>
    );
  }

  const n = selected.length;
  const exact = n === 3;
  const rosterFull = data.roster.length >= 5;
  const isConfirmed = !!data.confirmedAt && exact;
  const hasGame = !!data.gameId;

  function toggle(profileId: string) {
    setSelected((prev) => (prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]));
    setShowError(false);
  }

  async function handleConfirm() {
    if (!exact) {
      setShowError(true);
      return;
    }
    if (!data!.gameId) return;
    await setLineup.mutateAsync({ gameId: data!.gameId, lineupId: data!.lineupId, profileIds: selected, confirm: true });
    setShowError(false);
  }

  async function handleInvite() {
    if (rosterFull) return;
    try {
      await Share.share({ message: `Join ${data!.teamName} on Beacon — ask your captain to add you to the roster.` });
    } catch {
      // user dismissed the share sheet
    }
  }

  const countColor = exact ? color.verified : n > 3 ? color.ember : color.textPrimary;
  let errorText = '';
  if (n < 3) errorText = `Pick ${3 - n} more ${3 - n === 1 ? 'player' : 'players'} — Apex is played in trios, so exactly 3 must start.`;
  else if (n > 3) errorText = `That's ${n} players. Drop ${n - 3} to get back to a trio.`;

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
        </View>

        {data.gameId && (
          <View style={styles.nextGameBox}>
            <View style={{ gap: 5 }}>
              <Text style={styles.nextGameLabel}>LINEUP FOR</Text>
              <Text style={styles.nextGameTitle}>
                Match {data.roundNumber} · Game {data.gameNumber}
              </Text>
              <Text style={styles.nextGameMeta}>
                {data.scheduledAt ? formatWhen(data.scheduledAt) : ''} · 20-team lobby · trios
              </Text>
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              <Text style={[styles.selectedCount, { color: countColor }, tabularNums]}>{n} / 3</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      { backgroundColor: i < Math.min(n, 3) ? (exact ? color.verified : color.textPrimary) : n > 3 ? color.ember : 'rgba(242,241,236,0.16)' },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.rosterHeaderRow}>
          <Text style={styles.sectionLabel}>Roster</Text>
          <Text style={styles.hint}>{hasGame ? 'Tap to add or drop' : 'No upcoming match'}</Text>
        </View>

        {data.roster.map((p) => (
          <PlayerRow
            key={p.profileId}
            player={p}
            selectable={hasGame}
            selected={hasGame && selected.includes(p.profileId)}
            onToggle={() => toggle(p.profileId)}
          />
        ))}

        {!rosterFull && (
          <View style={styles.emptySlot}>
            <Text style={styles.emptySlotTitle}>EMPTY ROSTER SLOT</Text>
            <Text style={styles.emptySlotCopy}>Room for {5 - data.roster.length} more</Text>
          </View>
        )}

        <Pressable onPress={handleInvite} disabled={rosterFull}>
          {({ pressed, hovered }: any) => (
            <View
              style={[
                styles.inviteButton,
                rosterFull
                  ? { backgroundColor: color.fillMuted, borderColor: color.fillMutedBorder }
                  : (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted },
              ]}
            >
              <Text style={[styles.inviteLabel, rosterFull && { color: 'rgba(242,241,236,0.35)' }]}>Invite teammate</Text>
            </View>
          )}
        </Pressable>

        {rosterFull && (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>Roster is full at 5. Drop a player to free a slot before inviting anyone new.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        {hasGame ? (
          <>
            {showError && !exact && (
              <View style={styles.errorBox}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            )}
            {isConfirmed && !showError && (
              <View style={styles.confirmedBox}>
                <Diamond size={9} color={color.verified} />
                <Text style={styles.confirmedText}>
                  Lineup submitted. You can change it until {data.lockAt ? formatClock(data.lockAt) : 'lock'}.
                </Text>
              </View>
            )}

            <Pressable onPress={handleConfirm} disabled={setLineup.isPending}>
              {({ pressed, hovered }: any) => (
                <CornerCut
                  cut={10}
                  fill={isConfirmed ? color.verifiedTint : pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
                  strokeColor={isConfirmed ? color.verifiedTintBorder : 'transparent'}
                  style={styles.confirmOuter}
                >
                  <View style={styles.confirmContent}>
                    {setLineup.isPending ? (
                      <Spinner size={14} strokeColor={color.base} />
                    ) : (
                      <Text style={[styles.confirmLabel, { color: isConfirmed ? color.verified : color.base }]}>
                        {isConfirmed ? 'Lineup confirmed' : 'Confirm lineup'}
                      </Text>
                    )}
                  </View>
                </CornerCut>
              )}
            </Pressable>

            <Text style={styles.footerNote}>
              Lineup locks {data.lockAt ? formatClock(data.lockAt) : ''}, 10 minutes before the lobby opens.
            </Text>
          </>
        ) : (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>No upcoming match yet. Once your league admin schedules one, you'll be able to pick your trio here.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function PlayerRow({
  player,
  selected,
  selectable,
  onToggle,
}: {
  player: RosterPlayer;
  selected: boolean;
  selectable: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={selectable ? onToggle : undefined}>
      {({ pressed }: any) => (
        <CornerCut
          cut={14}
          fill={selected ? color.panel : color.base}
          strokeColor={selected ? 'rgba(62,213,152,0.4)' : color.hairline}
          style={styles.rowOuter}
        >
          <View style={styles.rowContent}>
            <View style={[styles.avatar, { borderColor: selected ? 'rgba(242,241,236,0.3)' : color.hairlineInput }]}>
              <Text style={[styles.avatarLabel, { color: selected ? color.textPrimary : color.textMuted }]}>{player.initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <Text style={[styles.playerName, { color: selected ? color.textPrimary : color.textMuted }]}>{player.name}</Text>
                {player.verified && <Diamond size={8} color={color.verified} />}
              </View>
              <Text style={styles.playerMeta}>{player.meta}</Text>
            </View>
            <View style={{ gap: 7, alignItems: 'flex-end' }}>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipLabel}>{player.role.toUpperCase()}</Text>
              </View>
              {selectable && (
                <View style={[styles.checkbox, { borderColor: selected ? color.verified : color.hairlineStrong, backgroundColor: selected ? color.verified : 'transparent' }]}>
                  {selected && <Diamond size={10} color={color.base} />}
                </View>
              )}
            </View>
          </View>
        </CornerCut>
      )}
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
  selectedCount: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26, ...tabularNums },
  pip: { width: 16, height: 4 },
  list: { padding: 22, paddingTop: 16, gap: 10 },
  rosterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  hint: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  rowOuter: { width: '100%' },
  rowContent: { padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13 },
  playerName: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
  playerMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  roleChip: { borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 3, paddingHorizontal: 6 },
  roleChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  checkbox: { width: 26, height: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptySlot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(242,241,236,0.22)',
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 14,
  },
  emptySlotTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 13, letterSpacing: 0.14 * 13, color: color.textMuted },
  emptySlotCopy: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  inviteButton: { height: 44, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  inviteLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26, gap: 12, borderTopWidth: 1, borderTopColor: color.hairline },
  errorBox: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    backgroundColor: color.emberTint,
    borderWidth: 1,
    borderColor: color.emberTintBorder,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  errorDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.ember, marginTop: 4 },
  errorText: { flex: 1, fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 17, color: color.ember },
  confirmedBox: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    backgroundColor: color.verifiedTint,
    borderWidth: 1,
    borderColor: color.verifiedTintBorder,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  confirmedText: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.verified },
  confirmOuter: { height: 52, width: '100%' },
  confirmContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
  footerNote: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, textAlign: 'center' },
});
