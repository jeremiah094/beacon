import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { FixtureRosterPlayer, useFixtureLineup, useSetFixtureLineup } from '../../../../lib/api/fixturesPlayer';

const STARTERS_NEEDED = 5;

// Head-to-head equivalent of teams/[teamId]/lineup.tsx. Simpler than the
// Apex screen on purpose: fixture_lineups has no confirm/sub-request flow
// of its own (just a set of 5 profile_ids per team per fixture), so this
// is one screen that becomes read-only once locked, rather than a
// separate lineup.tsx/locked.tsx pair.
export default function FixtureLineup() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { data, isLoading } = useFixtureLineup(teamId);
  const setLineup = useSetFixtureLineup(teamId);

  const [selected, setSelected] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showError, setShowError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setSelected(data.selectedProfileIds);
      setInitialized(true);
    }
  }, [data, initialized]);

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
  const exact = n === STARTERS_NEEDED;
  const rosterFull = data.roster.length >= 5;
  const hasFixture = !!data.fixtureId;
  const locked = data.isLocked;

  function toggle(profileId: string) {
    if (locked) return;
    setSelected((prev) => (prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]));
    setShowError(false);
    setJustSaved(false);
  }

  async function handleSave() {
    if (!exact) {
      setShowError(true);
      return;
    }
    if (!data!.fixtureId) return;
    setSaveError(null);
    try {
      await setLineup.mutateAsync({ fixtureId: data!.fixtureId, profileIds: selected });
      setJustSaved(true);
      setShowError(false);
    } catch (err) {
      const message = (err as { message?: string } | null)?.message;
      setSaveError(message || 'Could not save the lineup. Try again.');
    }
  }

  async function handleInvite() {
    if (rosterFull) return;
    try {
      await Share.share({ message: `Join ${data!.teamName} on Beacon — ask your captain to add you to the roster.` });
    } catch {
      // user dismissed the share sheet
    }
  }

  const countColor = exact ? color.verified : n > STARTERS_NEEDED ? color.ember : color.textPrimary;
  let errorText = '';
  if (n < STARTERS_NEEDED) errorText = `Pick ${STARTERS_NEEDED - n} more ${STARTERS_NEEDED - n === 1 ? 'player' : 'players'} — Valorant is played 5v5, so exactly 5 must start.`;
  else if (n > STARTERS_NEEDED) errorText = `That's ${n} players. Drop ${n - STARTERS_NEEDED} to get back to 5.`;

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
          {locked && (
            <View style={styles.lockedChip}>
              <View style={styles.lockedChipIcon} />
              <Text style={styles.lockedChipLabel}>LOCKED</Text>
            </View>
          )}
        </View>

        {data.fixtureId && (
          <View style={styles.nextFixtureBox}>
            <View style={{ gap: 5 }}>
              <Text style={styles.nextFixtureLabel}>STARTING 5 FOR</Text>
              <Text style={styles.nextFixtureTitle}>vs {data.opponentName}</Text>
              <Text style={styles.nextFixtureMeta}>
                {data.scheduledAt ? formatWhen(data.scheduledAt) : ''} · Bo{data.bestOf}
              </Text>
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              <Text style={[styles.selectedCount, { color: locked ? color.textPrimary : countColor }, tabularNums]}>{n} / {STARTERS_NEEDED}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {Array.from({ length: STARTERS_NEEDED }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      { backgroundColor: locked ? color.textPrimary : i < Math.min(n, STARTERS_NEEDED) ? (exact ? color.verified : color.textPrimary) : n > STARTERS_NEEDED ? color.ember : 'rgba(242,241,236,0.16)' },
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
          <Text style={styles.hint}>{!hasFixture ? 'No upcoming fixture' : locked ? 'Read-only' : 'Tap to add or drop'}</Text>
        </View>

        {data.roster.map((p) => (
          <PlayerRow
            key={p.profileId}
            player={p}
            selectable={hasFixture && !locked}
            selected={hasFixture && selected.includes(p.profileId)}
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

        {locked && (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>
              Starting 5 locks 10 minutes before the series starts, same as every Beacon lineup — nobody can change it after that point.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        {hasFixture ? (
          locked ? (
            <View style={styles.confirmedDisabled}>
              <View style={styles.confirmedDisabledIcon} />
              <Text style={styles.confirmedDisabledLabel}>Starting 5 locked</Text>
            </View>
          ) : (
            <>
              {showError && !exact && (
                <View style={styles.errorBox}>
                  <View style={styles.errorDot} />
                  <Text style={styles.errorText}>{errorText}</Text>
                </View>
              )}
              {saveError && !showError && (
                <View style={styles.errorBox}>
                  <View style={styles.errorDot} />
                  <Text style={styles.errorText}>{saveError}</Text>
                </View>
              )}
              {justSaved && exact && !showError && !saveError && (
                <View style={styles.confirmedBox}>
                  <Diamond size={9} color={color.verified} />
                  <Text style={styles.confirmedText}>
                    Starting 5 saved. You can change it until {data.lockAt ? formatClock(data.lockAt) : 'lock'}.
                  </Text>
                </View>
              )}

              <Pressable onPress={handleSave} disabled={setLineup.isPending}>
                {({ pressed, hovered }: any) => (
                  <CornerCut
                    cut={10}
                    fill={justSaved && exact ? color.verifiedTint : pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
                    strokeColor={justSaved && exact ? color.verifiedTintBorder : 'transparent'}
                    style={styles.confirmOuter}
                  >
                    <View style={styles.confirmContent}>
                      {setLineup.isPending ? (
                        <Spinner size={14} strokeColor={color.base} />
                      ) : (
                        <Text style={[styles.confirmLabel, { color: justSaved && exact ? color.verified : color.base }]}>
                          {justSaved && exact ? 'Starting 5 saved' : 'Save starting 5'}
                        </Text>
                      )}
                    </View>
                  </CornerCut>
                )}
              </Pressable>

              <Text style={styles.footerNote}>Locks {data.lockAt ? formatClock(data.lockAt) : ''}, 10 minutes before the series starts.</Text>
            </>
          )
        ) : (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>No upcoming fixture yet. Once your league admin schedules one, you'll be able to pick your 5 here.</Text>
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
  player: FixtureRosterPlayer;
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
              {!selectable && selected && (
                <View style={styles.lockedInRow}>
                  <Diamond size={7} color={color.verified} />
                  <Text style={styles.lockedInLabel}>STARTING</Text>
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
  lockedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 5, paddingHorizontal: 8, marginTop: 3 },
  lockedChipIcon: { width: 8, height: 8, borderWidth: 1, borderColor: color.textPrimary },
  lockedChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textPrimary },
  nextFixtureBox: {
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
  nextFixtureLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  nextFixtureTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, color: color.textPrimary },
  nextFixtureMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  selectedCount: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26, ...tabularNums },
  pip: { width: 12, height: 4 },
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
  lockedInRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockedInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.1 * 9, color: color.verified },
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
});
