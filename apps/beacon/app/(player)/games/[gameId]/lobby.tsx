import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ClipboardAPI from 'expo-clipboard';
import { CornerCut } from '../../../../components/CornerCut';
import { Diamond } from '../../../../components/Diamond';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { useCountdownLabel } from '../../../../lib/hooks/useCountdown';
import { useSession } from '../../../../lib/hooks/useSession';
import { useMatchLobby, useResolveTeamForGame } from '../../../../lib/api/matchLobby';

// Reference: Beacon 09 Match Lobby.dc.html — this is the highest-stakes
// screen in the app and must work cold from the T-10m push, with no prior
// navigation context (see useResolveTeamForGame).
export default function MatchLobby() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { userId } = useSession();
  const { data: teamId, isLoading: resolvingTeam } = useResolveTeamForGame(gameId, userId);
  const { data, isLoading } = useMatchLobby(gameId, teamId);
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
  const codeChars = Array.from({ length: 5 }).map((_, i) => code[i] ?? '');

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
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(player)/stats'))}
          >
            <View style={styles.backButton}>
              <Text style={styles.backLabel}>←</Text>
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Text style={styles.contextTitle}>
              Match {data.roundNumber} · Game {data.gameNumber}
            </Text>
            <Text style={[styles.contextMeta, tabularNums]}>
              {data.teamName}
              {data.leagueName ? ` · ${data.leagueName}` : ''}
              {data.map ? ` · ${data.map}` : ''}
            </Text>
          </View>
          <View style={styles.liveSoonChip}>
            <View style={styles.liveSoonDot} />
            <Text style={styles.liveSoonLabel}>LIVE SOON</Text>
          </View>
        </View>

        <View style={styles.countdownBlock}>
          <Text style={styles.countdownLabel}>MATCH STARTS IN</Text>
          <Text style={[styles.countdownValue, tabularNums]}>{countdown}</Text>
          <Text style={[styles.countdownCaption, tabularNums]}>
            Lobby opens {formatClock(data.scheduledAt)} · be in the custom lobby before then
          </Text>
        </View>

        <CornerCut cut={22} fill={color.panel} strokeColor={color.emberBorderSoft} style={{ width: '100%' }}>
          <View style={styles.codeContent}>
            <View style={styles.codeHeaderRow}>
              <Text style={styles.codeLabel}>LOBBY CODE</Text>
              <Text style={styles.codeSubLabel}>
                {data.leagueName ?? ''} · Game {data.gameNumber}
              </Text>
            </View>

            <View style={styles.codeRow}>
              {codeChars.map((ch, i) => (
                <View key={i} style={styles.codeCell}>
                  <Text style={[styles.codeChar, tabularNums]}>{ch}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.codeInstruction}>Enter this in Apex Legends custom lobby.</Text>

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
                : "The admin hasn't set a code yet — check back closer to lobby time."}
            </Text>
          </View>
        </CornerCut>

        <View style={styles.trioBox}>
          <View style={styles.trioHeaderRow}>
            <Text style={styles.trioLabel}>YOUR TRIO</Text>
            <View style={styles.lockedInRow}>
              <Diamond size={7} color={color.verified} />
              <Text style={styles.lockedInLabel}>LOCKED IN</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {data.trio.map((p) => (
              <View key={p.profileId} style={styles.trioCard}>
                <Text style={styles.trioInitials}>{p.initials}</Text>
                <Text style={styles.trioName}>{p.name}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.trioFooter, tabularNums]}>
            {data.lockedAt ? `Locked ${formatClock(data.lockedAt)}.` : ''} 20 teams in this lobby · points from placement plus kills.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.dockedFooter}>
        <Text style={styles.contactLink}>Code not working? Contact the admin</Text>
      </View>
    </SafeAreaView>
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
  countdownBlock: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  countdownLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, color: color.ember },
  countdownValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 76, lineHeight: 76, letterSpacing: 0.02 * 76, color: color.ember },
  countdownCaption: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
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
  trioBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 16, paddingHorizontal: 18, gap: 12 },
  trioHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  trioLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  lockedInRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockedInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.1 * 9, color: color.verified },
  trioCard: { flex: 1, borderWidth: 1, borderColor: color.hairlineInput, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center', gap: 5 },
  trioInitials: { fontFamily: fontFamily.rajdhaniBold, fontSize: 13, color: color.textMuted },
  trioName: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  trioFooter: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26 },
  contactLink: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, textAlign: 'center' },
});
