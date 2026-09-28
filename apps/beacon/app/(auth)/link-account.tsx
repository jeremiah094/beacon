import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CornerCut } from '../../components/CornerCut';
import { HudPanel } from '../../components/Panel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatGrid } from '../../components/StatGrid';
import { StatusBadge } from '../../components/StatusBadge';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily, titleColors } from '../../theme/tokens';
import { ApexLinkStats, ApexPlatform, PLATFORM_OPTIONS, linkApexId } from '../../lib/api/apexLink';
import { ValorantLinkStats, linkValorantId } from '../../lib/api/valorantLink';
import { titleMeta } from '../../lib/titles';

type Phase = 'form' | 'verifying' | 'verified';

// The per-title equivalent of sign-up.tsx's old 'linking' phase, now
// reached from choose-game for any title (not just Apex, and not only
// right after sign-up — sign-in lands here too if unverified).
export default function LinkAccount() {
  const { title: titleParam } = useLocalSearchParams<{ title: string }>();
  const title = titleMeta(titleParam ?? 'apex');
  const accent = titleColors(title.slug);
  const isApex = title.slug === 'apex';
  const isValorant = title.slug === 'valorant';

  const [phase, setPhase] = useState<Phase>('form');
  const [idType, setIdType] = useState<'ea' | 'apex'>('ea');
  const [platform, setPlatform] = useState<ApexPlatform>('PC');
  const [gamerId, setGamerId] = useState('');
  const [riotId, setRiotId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apexStats, setApexStats] = useState<ApexLinkStats | null>(null);
  const [valorantStats, setValorantStats] = useState<ValorantLinkStats | null>(null);

  const linkReady = isApex ? gamerId.trim().length >= 3 : isValorant ? riotId.trim().includes('#') : false;

  function continueToApp() {
    router.replace('/(player)/stats');
  }

  async function runApexLink() {
    setPhase('verifying');
    setError(null);
    const result = await linkApexId(gamerId.trim(), platform);
    if (result.ok) {
      setApexStats(result.stats);
      setPhase('verified');
    } else {
      setError(result.message);
      setPhase('form');
    }
  }

  async function runValorantLink() {
    setPhase('verifying');
    setError(null);
    const result = await linkValorantId(riotId.trim());
    if (result.ok) {
      setValorantStats(result.stats);
      setPhase('verified');
    } else {
      setError(result.message);
      setPhase('form');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ gap: 6 }}>
          <Text style={[styles.eyebrow, { color: accent.accent }]}>{title.name.toUpperCase()}</Text>
          <Text style={styles.heading}>Link your account</Text>
        </View>

        {phase === 'form' && title.verificationAvailable && (
          <HudPanel contentStyle={{ padding: 20, gap: 16 }} strokeColor={accent.accentBorder}>
            {isApex && (
              <>
                <Text style={styles.bodyCopy}>
                  Beacon reads your rank, K/D and wins straight from your account, so every stat in the league is
                  verified rather than self-reported.
                </Text>
                <SegmentedControl
                  height={44}
                  options={[
                    { value: 'ea', label: 'EA Play ID' },
                    { value: 'apex', label: 'Apex Legends ID' },
                  ]}
                  value={idType}
                  onChange={setIdType}
                />
                <View style={{ gap: 8 }}>
                  <Text style={styles.platformLabel}>Platform</Text>
                  <SegmentedControl height={40} options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} />
                </View>
                <TextInput
                  value={gamerId}
                  onChangeText={setGamerId}
                  placeholder={idType === 'ea' ? 'EA Play ID · e.g. VipersKane_IE' : 'Apex Legends ID · e.g. VipersKane'}
                  autoCapitalize="none"
                  placeholderTextColor={color.fillPlaceholder}
                  style={styles.bareInput}
                />
              </>
            )}
            {isValorant && (
              <>
                <Text style={styles.bodyCopy}>
                  Beacon confirms your Riot account is real using Riot's own API. Rank and match stats aren't
                  pulled automatically for Valorant yet — this just verifies your identity.
                </Text>
                <TextInput
                  value={riotId}
                  onChangeText={setRiotId}
                  placeholder="Riot ID · e.g. Player#EUW1"
                  autoCapitalize="none"
                  placeholderTextColor={color.fillPlaceholder}
                  style={styles.bareInput}
                />
                <Text style={styles.helpText}>Found in-game under your profile, or in the Riot Client settings.</Text>
              </>
            )}
          </HudPanel>
        )}

        {phase === 'form' && !title.verificationAvailable && (
          <HudPanel contentStyle={{ padding: 20, gap: 12 }}>
            <Text style={styles.bodyCopy}>
              Automatic account verification for {title.name} is coming soon. You can still browse leagues and
              join a team now — we'll ask you to link an account once it's ready.
            </Text>
          </HudPanel>
        )}

        {phase === 'verifying' && (
          <View style={{ gap: 16, paddingTop: 24 }}>
            <Spinner size={16} strokeColor={color.textMuted} />
            <Text style={styles.bodyCopy}>Checking with {isApex ? 'EA' : 'Riot'}…</Text>
          </View>
        )}

        {phase === 'verified' && (apexStats || valorantStats) && (
          <View style={{ gap: 16 }}>
            <StatusBadge variant="verified" label={`${isApex ? 'EA' : 'RIOT'} VERIFIED`} />
            {apexStats && (
              <StatGrid
                stats={[
                  { value: apexStats.kd != null ? apexStats.kd.toFixed(2) : '—', label: 'K/D' },
                  { value: apexStats.wins != null ? String(apexStats.wins) : '—', label: 'WINS' },
                  { value: apexStats.rankName ?? '—', label: 'RANK' },
                ]}
              />
            )}
            {valorantStats && <Text style={styles.bodyCopy}>Linked as {valorantStats.riotId}.</Text>}
          </View>
        )}

        {error && (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={[styles.noteText, { color: color.textPrimary }]}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        {phase === 'form' && title.verificationAvailable && (
          <Pressable onPress={isApex ? runApexLink : runValorantLink} disabled={!linkReady}>
            {({ pressed, hovered }: any) => (
              <CornerCut
                cut={10}
                fill={!linkReady ? color.fillMuted : pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
                strokeColor="transparent"
                style={styles.primaryOuter}
              >
                <View style={styles.primaryContent}>
                  <Text style={[styles.primaryLabel, { color: !linkReady ? 'rgba(242,241,236,0.35)' : color.base }]}>Link account</Text>
                </View>
              </CornerCut>
            )}
          </Pressable>
        )}

        {(phase === 'form' || phase === 'verified') && (
          <Pressable onPress={continueToApp}>
            <Text style={styles.skipLabel}>
              {phase === 'verified'
                ? 'Continue to your dashboard'
                : title.verificationAvailable
                  ? 'Skip for now — you can link later from your profile'
                  : 'Continue'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  scroll: { padding: 22, paddingTop: 12, gap: 22 },
  eyebrow: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, textTransform: 'uppercase' },
  heading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, lineHeight: 32, color: color.textPrimary },
  bodyCopy: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19.5, color: color.textMuted },
  platformLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, textTransform: 'uppercase', color: color.textMuted },
  helpText: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  bareInput: {
    height: 50,
    backgroundColor: color.base,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    color: color.textPrimary,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26, gap: 12 },
  primaryOuter: { height: 52, width: '100%' },
  primaryContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
  skipLabel: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, textAlign: 'center' },
});
