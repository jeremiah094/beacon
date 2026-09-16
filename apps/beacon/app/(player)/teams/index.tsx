import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../../../components/BottomNav';
import { CornerCut } from '../../../components/CornerCut';
import { Diamond } from '../../../components/Diamond';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily } from '../../../theme/tokens';
import { useSession } from '../../../lib/hooks/useSession';
import { useActiveTeam } from '../../../lib/hooks/useActiveTeam';
import { MyTeam, useCreateTeam, useMyTeams } from '../../../lib/api/teams';

// Reference: Beacon 04 My Teams.dc.html
export default function MyTeams() {
  const { userId } = useSession();
  const { data: teams, isLoading } = useMyTeams(userId);
  const { joinLeagueId } = useLocalSearchParams<{ joinLeagueId?: string }>();
  const list = teams ?? [];
  const { activeTeamId, setActiveTeam } = useActiveTeam(list.map((t) => t.id));
  const [showCreate, setShowCreate] = useState(!!joinLeagueId);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createTeam = useCreateTeam(userId);

  const atLimit = list.length >= 3;

  async function handleCreate() {
    if (!name.trim()) return;
    setCreateError(null);
    try {
      const newId = await createTeam.mutateAsync({ name: name.trim(), tag: tag.trim(), joinLeagueId });
      setActiveTeam(newId);
      setName('');
      setTag('');
      setShowCreate(false);
    } catch (err) {
      // Supabase's PostgrestError is a plain { message, details, hint, code }
      // object, not an Error instance — `instanceof Error` misses it and
      // was masking every real RLS/DB error behind the generic fallback.
      const message = (err as { message?: string } | null)?.message;
      setCreateError(message || 'Could not create the team. Try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>MY TEAMS</Text>
        </View>
        <View style={styles.slotsRow}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.slotTick, { backgroundColor: i < list.length ? color.textPrimary : 'rgba(242,241,236,0.16)' }]} />
            ))}
          </View>
          <Text style={styles.slotLabel}>{list.length} of 3 team slots used</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size={20} />
          </View>
        ) : (
          list.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              isActive={t.id === activeTeamId}
              onSelect={() => setActiveTeam(t.id)}
              onManage={() => router.push({ pathname: '/(player)/teams/[teamId]/lineup', params: { teamId: t.id } } as any)}
            />
          ))
        )}

        {!atLimit && !showCreate && (
          <Pressable onPress={() => setShowCreate(true)}>
            {({ hovered }: any) => (
              <View style={[styles.emptySlot, hovered && { borderColor: 'rgba(242,241,236,0.45)' }]}>
                <Text style={styles.emptySlotTitle}>EMPTY SLOT</Text>
                <Text style={styles.emptySlotCopy}>Room for {3 - list.length} more</Text>
              </View>
            )}
          </Pressable>
        )}

        {showCreate && (
          <View style={styles.createForm}>
            <Text style={styles.createLabel}>
              {joinLeagueId ? 'Create a team to register' : 'Create a new team'}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Team name · e.g. Shannon Vipers"
              placeholderTextColor={color.fillPlaceholder}
              style={styles.createInput}
            />
            <TextInput
              value={tag}
              onChangeText={setTag}
              placeholder="Tag · e.g. SV (optional)"
              placeholderTextColor={color.fillPlaceholder}
              autoCapitalize="characters"
              maxLength={4}
              style={styles.createInput}
            />
            {createError && (
              <View style={styles.noteRow}>
                <View style={styles.noteBar} />
                <Text style={[styles.noteText, { color: color.textPrimary }]}>{createError}</Text>
              </View>
            )}
            <Pressable onPress={handleCreate} disabled={!name.trim() || createTeam.isPending}>
              {({ pressed, hovered }: any) => (
                <View
                  style={[
                    styles.createButton,
                    !name.trim() && { opacity: 0.5 },
                    (pressed || hovered) && name.trim() && { backgroundColor: color.fillHover },
                  ]}
                >
                  {createTeam.isPending ? (
                    <Spinner size={14} strokeColor={color.base} />
                  ) : (
                    <Text style={styles.createButtonLabel}>Create team</Text>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        {atLimit && (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>
              You've reached the 3-team limit. Leave a team to join another — tap a team, then{' '}
              <Text style={{ color: color.textPrimary }}>Manage</Text> to leave.
            </Text>
          </View>
        )}
        <Pressable onPress={() => !atLimit && setShowCreate(true)} disabled={atLimit}>
          {({ pressed, hovered }: any) => (
            <CornerCut
              cut={10}
              fill={atLimit ? color.fillMuted : pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
              strokeColor={atLimit ? color.fillMutedBorder : color.textPrimary}
              style={styles.primaryOuter}
            >
              <View style={styles.primaryContent}>
                <Text style={[styles.primaryLabel, { color: atLimit ? 'rgba(242,241,236,0.35)' : color.base }]}>
                  Join or create a team
                </Text>
              </View>
            </CornerCut>
          )}
        </Pressable>
      </View>

      <BottomNav active="teams" />
    </SafeAreaView>
  );
}

function TeamCard({
  team,
  isActive,
  onSelect,
  onManage,
}: {
  team: MyTeam;
  isActive: boolean;
  onSelect: () => void;
  onManage: () => void;
}) {
  return (
    <Pressable onPress={isActive ? onManage : onSelect}>
      <CornerCut
        cut={18}
        fill={isActive ? color.panel : color.base}
        strokeColor={isActive ? 'rgba(62,213,152,0.4)' : color.hairline}
        style={styles.cardOuter}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <CornerCut cut={10} fill="none" strokeColor={isActive ? 'rgba(242,241,236,0.3)' : color.hairlineInput} style={styles.mark}>
              <View style={styles.markInner}>
                <Text style={[styles.markLabel, { color: isActive ? color.textPrimary : color.textMuted }]}>{team.initials}</Text>
              </View>
            </CornerCut>
            <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
              <Text style={[styles.teamName, { color: isActive ? color.textPrimary : color.textMuted }]}>{team.name}</Text>
              <Text style={styles.teamLeague}>{team.leagueName ?? 'No league yet'}</Text>
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              {isActive && (
                <View style={styles.activeChip}>
                  <Diamond size={7} color={color.verified} />
                  <Text style={styles.activeChipLabel}>ACTIVE</Text>
                </View>
              )}
              <View style={styles.roleChip}>
                <Text style={styles.roleChipLabel}>{team.role.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={styles.cardMeta}>{team.meta}</Text>
            <Text style={[styles.cardAction, { color: isActive ? color.textPrimary : color.verified }]}>
              {isActive ? 'Manage →' : 'Switch to this team'}
            </Text>
          </View>
        </View>
      </CornerCut>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  header: { padding: 22, paddingBottom: 18, gap: 14, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 18, color: color.textMuted },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, letterSpacing: 0.01 * 30, color: color.textPrimary },
  slotsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotTick: { width: 22, height: 4 },
  slotLabel: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  list: { padding: 22, paddingTop: 18, gap: 12 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  cardOuter: { width: '100%' },
  cardContent: { padding: 18, gap: 14 },
  cardTopRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  mark: { width: 44, height: 44 },
  markInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 15 },
  teamName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 19, letterSpacing: 0.01 * 19 },
  teamLeague: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: color.verifiedTint,
    borderWidth: 1,
    borderColor: color.verifiedTintBorder,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  activeChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.verified },
  roleChip: { borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 4, paddingHorizontal: 7 },
  roleChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    paddingTop: 13,
  },
  cardMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  cardAction: { fontFamily: fontFamily.interSemiBold, fontSize: 11 },
  emptySlot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(242,241,236,0.22)',
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 18,
  },
  emptySlotTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 15, letterSpacing: 0.14 * 15, color: color.textMuted },
  emptySlotCopy: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  createForm: { gap: 10, padding: 18, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel },
  createLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.12 * 11, color: color.textMuted, textTransform: 'uppercase' },
  createInput: {
    height: 46,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    backgroundColor: color.base,
    color: color.textPrimary,
    paddingHorizontal: 12,
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
  },
  createButton: { height: 46, backgroundColor: color.textPrimary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  createButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.base },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26, gap: 12 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  primaryOuter: { height: 52, width: '100%' },
  primaryContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
});
