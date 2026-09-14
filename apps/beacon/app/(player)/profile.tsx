import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BottomNav } from '../../components/BottomNav';
import { CornerCut } from '../../components/CornerCut';
import { Diamond } from '../../components/Diamond';
import { HudPanel } from '../../components/Panel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatGrid } from '../../components/StatGrid';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily } from '../../theme/tokens';
import { formatRelativeTime } from '../../lib/time';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/hooks/useSession';
import { useDashboard } from '../../lib/api/dashboard';
import { ApexPlatform, PLATFORM_OPTIONS, linkApexId } from '../../lib/api/apexLink';

// Not one of BUILD.md's 16 reference screens — added alongside the bottom
// nav as the account/settings hub every tab bar needs. Reuses the same
// EA/Apex linking flow as screen 01, for accounts that used "Skip for
// now" there and want to link later without signing out first.
type IdType = 'ea' | 'apex';

export default function Profile() {
  const { session, userId } = useSession();
  const { data, isLoading } = useDashboard(userId);
  const queryClient = useQueryClient();

  const [idType, setIdType] = useState<IdType>('ea');
  const [platform, setPlatform] = useState<ApexPlatform>('PC');
  const [gamerId, setGamerId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const isEa = idType === 'ea';
  const linkReady = gamerId.trim().length >= 3;

  async function handleLink() {
    if (!linkReady) return;
    setLinking(true);
    setLinkError(null);
    const result = await linkApexId(gamerId.trim(), platform);
    setLinking(false);
    if (result.ok) {
      setGamerId('');
      queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
    } else {
      setLinkError(result.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-up');
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingBox}>
          <Spinner size={20} />
        </View>
        <BottomNav active="profile" />
      </SafeAreaView>
    );
  }

  const initials = (data.gamertag ?? data.displayName ?? '??').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>PROFILE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identityRow}>
          <CornerCut cut={12} fill="none" strokeColor={color.hairlineStrong} style={styles.avatar}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarLabel}>{initials}</Text>
            </View>
          </CornerCut>
          <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
            <Text style={styles.gamertag}>{data.gamertag ?? data.displayName ?? 'Player'}</Text>
            <Text style={styles.email}>{session?.user.email ?? '—'}</Text>
          </View>
        </View>

        {data.isVerified ? (
          <HudPanel variant="verified" contentStyle={{ padding: 18, gap: 14 }}>
            <View style={styles.verifiedHeaderRow}>
              <Diamond size={8} color={color.verified} />
              <Text style={styles.verifiedHeaderLabel}>EA VERIFIED</Text>
            </View>
            <StatGrid
              stats={[
                { value: data.stats?.kd != null ? data.stats.kd.toFixed(2) : '—', label: 'K/D' },
                { value: data.stats?.wins != null ? String(data.stats.wins) : '—', label: 'WINS' },
                { value: data.stats?.rankName ?? '—', label: 'RANK' },
              ]}
            />
            <Text style={styles.helpText}>
              {data.stats?.fetchedAt ? `Synced ${formatRelativeTime(data.stats.fetchedAt)}` : 'Stats read from your linked account.'}
            </Text>
          </HudPanel>
        ) : (
          <HudPanel contentStyle={{ padding: 20, gap: 16 }}>
            <Text style={[styles.eyebrow, { color: color.textPrimary }]}>Link your gaming ID</Text>
            <Text style={styles.linkCopy}>
              You skipped this when you signed up. Link it now so your stats are read, not entered by hand.
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
              placeholder={isEa ? 'EA Play ID · e.g. VipersKane_IE' : 'Apex Legends ID · e.g. VipersKane'}
              autoCapitalize="none"
              placeholderTextColor={color.fillPlaceholder}
              style={[styles.bareInput, { backgroundColor: color.base }]}
            />

            {linkError && (
              <View style={styles.noteRow}>
                <View style={styles.noteBar} />
                <Text style={styles.noteText}>{linkError}</Text>
              </View>
            )}

            <Pressable onPress={handleLink} disabled={!linkReady || linking}>
              {({ pressed, hovered }: any) => (
                <View
                  style={[
                    styles.linkButton,
                    !linkReady
                      ? { backgroundColor: color.fillMuted, borderColor: color.fillMutedBorder }
                      : { backgroundColor: pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary, borderColor: color.textPrimary },
                  ]}
                >
                  {linking ? (
                    <Spinner size={14} strokeColor={color.base} />
                  ) : (
                    <Text style={[styles.linkButtonLabel, { color: linkReady ? color.base : 'rgba(242,241,236,0.35)' }]}>Link account</Text>
                  )}
                </View>
              )}
            </Pressable>
          </HudPanel>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Settings</Text>
          <Pressable onPress={() => router.push('/(player)/notifications')}>
            {({ hovered }: any) => (
              <View style={[styles.settingsRow, hovered && { borderColor: color.hairlineStrong }]}>
                <Text style={styles.settingsLabel}>Notifications</Text>
                <Text style={styles.chevron}>→</Text>
              </View>
            )}
          </Pressable>
        </View>

        <Pressable onPress={handleSignOut}>
          {({ hovered }: any) => (
            <View style={[styles.signOutRow, hovered && { borderColor: color.hairlineStrong }]}>
              <Text style={styles.signOutLabel}>Sign out</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>

      <BottomNav active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 22, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: color.hairline },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, letterSpacing: 0.01 * 28, color: color.textPrimary },
  scroll: { padding: 22, paddingTop: 18, gap: 20 },
  identityRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 56, height: 56 },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 20, color: color.textPrimary },
  gamertag: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, letterSpacing: 0.01 * 22, color: color.textPrimary },
  email: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  verifiedHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedHeaderLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.12 * 11, color: color.verified },
  helpText: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  eyebrow: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, textTransform: 'uppercase', color: color.textMuted },
  linkCopy: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19.5, color: color.textMuted },
  platformLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, textTransform: 'uppercase', color: color.textMuted },
  bareInput: {
    height: 50,
    backgroundColor: color.panel,
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
  linkButton: { height: 48, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  linkButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14 },
  section: { gap: 10 },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, textTransform: 'uppercase', color: color.textMuted },
  settingsRow: {
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  chevron: { fontFamily: fontFamily.interRegular, fontSize: 16, color: color.textMuted },
  signOutRow: { height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.hairline },
  signOutLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textMuted },
});
