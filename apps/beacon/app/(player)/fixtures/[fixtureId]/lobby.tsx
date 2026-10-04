import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ClipboardAPI from 'expo-clipboard';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useCountdownLabel } from '../../../../lib/hooks/useCountdown';
import { useSession } from '../../../../lib/hooks/useSession';
import { FixtureMapScore, useFixtureLobby, useResolveTeamForFixture } from '../../../../lib/api/fixturesPlayer';

// Head-to-head equivalent of games/[gameId]/lobby.tsx — "live score"
// instead of a single placement/kills result, since a fixture is a
// best-of-N series rather than one battle-royale lobby. Same cold-start
// requirement: must work from a push with no prior navigation context.
export default function FixtureLobby() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { userId } = useSession();
  const { data: teamId, isLoading: resolvingTeam } = useResolveTeamForFixture(fixtureId, userId);
  const { data, isLoading } = useFixtureLobby(fixtureId, teamId);
  const [copied, setCopied] = useState(false);

  const countdown = useCountdownLabel(data?.scheduledAt ?? null) ?? '00:00:00';

  if (resolvingTeam || isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
      </SafeAreaView>
    );
  }

  const code = data.lobbyCode ?? '';
  const codeLength = code ? code.length : 8;
  const codeChars = Array.from({ length: codeLength }).map((_, i) => code[i] ?? '');
  const codeCellGap = codeLength > 8 ? 5 : codeLength > 6 ? 6 : 8;
  const codeCharFontSize = codeLength > 8 ? 18 : codeLength > 6 ? 22 : 34;

  const isLive = data.status === 'live';
  const isUpcoming = data.status === 'scheduled' || data.status === 'lineup_lock';

  async function handleCopy() {
    if (!code) return;
    await ClipboardAPI.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contextBar}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(player)/stats'))}>
            <View style={styles.backButton}>
              <Text style={styles.backLabel}>←</Text>
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Text style={styles.contextTitle}>
              {data.myTeamName} vs {data.opponentName}
            </Text>
            <Text style={[styles.contextMeta, tabularNums]}>
              {data.leagueName ? `${data.leagueName} · ` : ''}Round {data.roundNumber} · Bo{data.bestOf}
            </Text>
          </View>
          {isLive ? (
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipLabel}>LIVE</Text>
            </View>
          ) : isUpcoming ? (
            <View style={styles.liveSoonChip}>
              <View style={styles.liveSoonDot} />
              <Text style={styles.liveSoonLabel}>LIVE SOON</Text>
            </View>
          ) : null}
        </View>

        {isUpcoming && (
          <View style={styles.countdownBlock}>
            <Text style={styles.countdownLabel}>SERIES STARTS IN</Text>
            <Text style={[styles.countdownValue, tabularNums]}>{countdown}</Text>
            <Text style={[styles.countdownCaption, tabularNums]}>
              Starts {formatClock(data.scheduledAt)} · be in the custom lobby before then
            </Text>
          </View>
        )}

        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>{isLive ? 'LIVE SCORE' : data.status === 'completed' ? 'FINAL' : 'SERIES'}</Text>
          <View style={styles.scoreRow}>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Text style={styles.scoreTeamName} numberOfLines={1}>{data.myTeamName}</Text>
              <Text style={[styles.scoreValue, data.myMapsWon > data.opponentMapsWon && { color: color.verified }, tabularNums]}>{data.myMapsWon}</Text>
            </View>
            <Text style={styles.scoreDash}>–</Text>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Text style={styles.scoreTeamName} numberOfLines={1}>{data.opponentName}</Text>
              <Text style={[styles.scoreValue, data.opponentMapsWon > data.myMapsWon && { color: color.verified }, tabularNums]}>{data.opponentMapsWon}</Text>
            </View>
          </View>

          {data.maps.length > 0 && (
            <View style={styles.mapsList}>
              {data.maps.map((m) => (
                <MapRow key={m.mapNumber} map={m} />
              ))}
            </View>
          )}
        </View>

        {data.streamLive && (
          <Pressable onPress={() => Linking.openURL(`https://twitch.tv/${data.observerTwitchLogin}`)}>
            {({ pressed, hovered }: any) => (
              <View
                style={[
                  styles.liveStreamButton,
                  { backgroundColor: pressed ? color.emberActive : hovered ? color.emberHover : color.ember },
                ]}
              >
                <View style={styles.liveStreamDot} />
                <Text style={styles.liveStreamLabel}>Live Stream</Text>
                <Text style={styles.liveStreamSub}>{data.streamViewers ?? 0} watching</Text>
              </View>
            )}
          </Pressable>
        )}

        {isUpcoming && (
          <CornerCut cut={22} fill={color.panel} strokeColor={color.emberBorderSoft} style={{ width: '100%' }}>
            <View style={styles.codeContent}>
              <View style={styles.codeHeaderRow}>
                <Text style={styles.codeLabel}>LOBBY CODE</Text>
                <Text style={styles.codeSubLabel}>Round {data.roundNumber}</Text>
              </View>

              <View style={[styles.codeRow, { gap: codeCellGap }]}>
                {codeChars.map((ch, i) => (
                  <View key={i} style={styles.codeCell}>
                    <Text style={[styles.codeChar, tabularNums, { fontSize: codeCharFontSize }]}>{ch}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.codeInstruction}>Enter this in the Valorant custom lobby.</Text>

              <Pressable onPress={handleCopy} disabled={!code}>
                {({ pressed, hovered }: any) => (
                  <View
                    style={[
                      styles.copyButton,
                      copied
                        ? { backgroundColor: color.verifiedTint, borderColor: color.verifiedTintBorder }
                        : { backgroundColor: pressed ? color.emberActive : hovered ? color.emberHover : color.ember, borderColor: color.ember },
                    ]}
                  >
                    {copied && <Diamond size={11} color={color.verified} />}
                    <Text style={[styles.copyLabel, { color: copied ? color.verified : color.base }]}>
                      {code ? (copied ? `Copied ${code}` : 'Copy code') : 'Code not set yet'}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Text style={[styles.copyHint, tabularNums]}>
                {code
                  ? copied
                    ? 'On your clipboard. Paste it into the custom lobby field.'
                    : `One tap puts ${code} on your clipboard.`
                  : "The admin hasn't set a code yet — check back closer to the series time."}
              </Text>
            </View>
          </CornerCut>
        )}

        {data.myStarters.length > 0 && (
          <View style={styles.startersBox}>
            <View style={styles.startersHeaderRow}>
              <Text style={styles.startersLabel}>YOUR STARTING 5</Text>
              {data.lineupLockedAt && (
                <View style={styles.lockedInRow}>
                  <Diamond size={7} color={color.verified} />
                  <Text style={styles.lockedInLabel}>LOCKED IN</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.myStarters.map((p) => (
                <View key={p.profileId} style={styles.starterCard}>
                  <Text style={styles.starterInitials}>{p.initials}</Text>
                  <Text style={styles.starterName} numberOfLines={1}>{p.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        <Text style={styles.contactLink}>Code not working? Contact the admin</Text>
      </View>
    </SafeAreaView>
  );
}

function MapRow({ map }: { map: FixtureMapScore }) {
  const played = map.homeScore != null && map.awayScore != null;
  return (
    <View style={styles.mapRow}>
      <Text style={styles.mapNumber}>Map {map.mapNumber}</Text>
      <Text style={styles.mapName} numberOfLines={1}>{map.mapName ?? 'TBC'}</Text>
      <Text style={[styles.mapScore, tabularNums]}>{played ? `${map.homeScore}–${map.awayScore}` : '—'}</Text>
    </View>
  );
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 22, paddingTop: 12, gap: 20 },
  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: color.hairline, paddingBottom: 16 },
  backButton: { width: 34, height: 34, borderWidth: 1, borderColor: color.neutralBorder, alignItems: 'center', justifyContent: 'center' },
  backLabel: { fontSize: 15, color: color.textMuted },
  contextTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  contextMeta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: color.emberTint, borderWidth: 1, borderColor: color.emberTintBorder, paddingVertical: 5, paddingHorizontal: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ember },
  liveChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.ember },
  liveSoonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: color.emberTint,
    borderWidth: 1,
    borderColor: color.emberTintBorder,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  liveSoonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ember },
  liveSoonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.ember },
  liveStreamButton: {
    height: 52,
    borderWidth: 1,
    borderColor: color.ember,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  liveStreamDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.base },
  liveStreamLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.base },
  liveStreamSub: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.base, opacity: 0.85 },
  countdownBlock: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  countdownLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, color: color.ember },
  countdownValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 60, lineHeight: 60, letterSpacing: 0.02 * 60, color: color.ember },
  countdownCaption: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  scoreBlock: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 18, gap: 16 },
  scoreLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, color: color.textMuted, textAlign: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreTeamName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  scoreValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 52, color: color.textMuted },
  scoreDash: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, color: color.textMuted },
  mapsList: { gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline, marginTop: 4 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.base, paddingVertical: 9, paddingHorizontal: 12 },
  mapNumber: { width: 54, fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textMuted },
  mapName: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textPrimary },
  mapScore: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 14, color: color.textPrimary },
  codeContent: { padding: 20, paddingHorizontal: 20, gap: 18 },
  codeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  codeLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, color: color.textMuted },
  codeSubLabel: { fontFamily: fontFamily.interRegular, fontSize: 10, letterSpacing: 0.06 * 10, color: color.textMuted },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  codeCell: { flex: 1, aspectRatio: 1 / 1.2, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, alignItems: 'center', justifyContent: 'center', maxWidth: 62 },
  codeChar: { fontFamily: fontFamily.rajdhaniBold, fontSize: 34, letterSpacing: 0.04 * 34, color: color.textPrimary },
  codeInstruction: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textPrimary, textAlign: 'center' },
  copyButton: { height: 56, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  copyLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 16 },
  copyHint: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, textAlign: 'center' },
  startersBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 16, paddingHorizontal: 18, gap: 12 },
  startersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  startersLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  lockedInRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockedInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.1 * 9, color: color.verified },
  starterCard: { width: '18%', minWidth: 58, borderWidth: 1, borderColor: color.hairlineInput, paddingVertical: 11, paddingHorizontal: 6, alignItems: 'center', gap: 5 },
  starterInitials: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13, color: color.textMuted },
  starterName: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textPrimary },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26 },
  contactLink: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, textAlign: 'center' },
});
