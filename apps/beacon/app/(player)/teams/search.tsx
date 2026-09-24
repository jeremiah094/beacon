import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CornerCut } from '../../../components/CornerCut';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily } from '../../../theme/tokens';
import { useSession } from '../../../lib/hooks/useSession';
import { TeamSearchResult, useMyPendingJoinRequests, useMyTeams, useRequestToJoinTeam, useSearchTeams } from '../../../lib/api/teams';

// Search-to-join, so a player who can't find their real team doesn't end
// up creating a duplicate — the whole point of this screen existing.
// Requesting is one tap; the team's captain approves it from the roster
// screen (lib/api/teamJoinRequests.ts), same shape as league registration
// approval elsewhere in the app.
export default function TeamSearch() {
  const { userId } = useSession();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const { data: myTeams } = useMyTeams(userId);
  const myTeamIds = (myTeams ?? []).map((t) => t.id);
  const { data: pending } = useMyPendingJoinRequests(userId);
  const { data: results, isLoading } = useSearchTeams(query, myTeamIds);
  const requestJoin = useRequestToJoinTeam(userId);

  const pendingSet = new Set([...(pending ?? []), ...requestedIds]);

  async function handleRequest(team: TeamSearchResult) {
    setError(null);
    try {
      await requestJoin.mutateAsync(team.id);
      setRequestedIds((prev) => [...prev, team.id]);
    } catch (err) {
      const message = (err as { message?: string } | null)?.message;
      setError(message || 'Could not send the request. Try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>FIND A TEAM</Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by team name…"
          placeholderTextColor={color.fillPlaceholder}
          autoCapitalize="none"
          autoFocus
          style={styles.searchInput}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {query.trim().length > 0 && query.trim().length < 2 && (
          <Text style={styles.hintText}>Keep typing — at least 2 characters.</Text>
        )}

        {isLoading && (
          <View style={styles.loadingBox}>
            <Spinner size={18} />
          </View>
        )}

        {!isLoading && query.trim().length >= 2 && (results ?? []).length === 0 && (
          <Text style={styles.hintText}>No teams found for "{query.trim()}".</Text>
        )}

        {(results ?? []).map((team) => {
          const requested = pendingSet.has(team.id);
          return (
            <View key={team.id} style={styles.resultRow}>
              <CornerCut cut={10} fill="none" strokeColor={color.hairlineInput} style={styles.mark}>
                <View style={styles.markInner}>
                  <Text style={styles.markLabel}>{team.initials}</Text>
                </View>
              </CornerCut>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.resultName} numberOfLines={1}>{team.name}</Text>
                {team.tag && <Text style={styles.resultTag}>{team.tag}</Text>}
              </View>
              <Pressable onPress={() => !requested && handleRequest(team)} disabled={requested || requestJoin.isPending}>
                {({ pressed, hovered }: any) => (
                  <View
                    style={[
                      styles.requestButton,
                      requested && { borderColor: color.verifiedTintBorder, backgroundColor: color.verifiedTint },
                      !requested && (pressed || hovered) && { backgroundColor: color.fillHover },
                    ]}
                  >
                    <Text style={[styles.requestLabel, requested && { color: color.verified }]}>
                      {requested ? 'Requested' : 'Request to join'}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}

        {error && (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={[styles.noteText, { color: color.textPrimary }]}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        <Text style={styles.footerHint}>Can't find your team?</Text>
        <Pressable onPress={() => router.replace({ pathname: '/(player)/teams', params: { create: '1' } } as any)}>
          {({ pressed, hovered }: any) => (
            <CornerCut
              cut={10}
              fill={pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
              strokeColor="transparent"
              style={styles.createOuter}
            >
              <View style={styles.createContent}>
                <Text style={styles.createLabel}>Create a new team</Text>
              </View>
            </CornerCut>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  header: { padding: 22, paddingBottom: 18, gap: 14, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 18, color: color.textMuted },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, letterSpacing: 0.01 * 28, color: color.textPrimary },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    backgroundColor: color.panel,
    color: color.textPrimary,
    paddingHorizontal: 14,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
  },
  list: { padding: 22, paddingTop: 16, gap: 10 },
  loadingBox: { paddingVertical: 30, alignItems: 'center' },
  hintText: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted, textAlign: 'center', paddingVertical: 20 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.panel,
    padding: 14,
  },
  mark: { width: 40, height: 40 },
  markInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 14, color: color.textMuted },
  resultName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 16, color: color.textPrimary },
  resultTag: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  requestButton: { height: 38, paddingHorizontal: 14, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  requestLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26, gap: 10, borderTopWidth: 1, borderTopColor: color.hairline },
  footerHint: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  createOuter: { height: 48, width: '100%' },
  createContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.base },
});
