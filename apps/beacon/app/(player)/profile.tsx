import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../../components/BottomNav';
import { CornerCut } from '../../components/CornerCut';
import { Diamond } from '../../components/Diamond';
import { HudPanel } from '../../components/Panel';
import { StatGrid } from '../../components/StatGrid';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily, titleColors } from '../../theme/tokens';
import { formatRelativeTime } from '../../lib/time';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/hooks/useSession';
import { useActiveTitle } from '../../lib/hooks/useActiveTitle';
import { useDashboard } from '../../lib/api/dashboard';
import { deleteAccount } from '../../lib/api/account';
import { PasswordConfirmPanel } from '../../components/PasswordConfirmPanel';
import { titleMeta } from '../../lib/titles';

// Not one of BUILD.md's 16 reference screens — added alongside the bottom
// nav as the account/settings hub every tab bar needs. Linking (any title)
// now goes through the shared (auth)/link-account screen instead of a
// duplicated inline form, for accounts that skipped it earlier.
export default function Profile() {
  const { session, userId } = useSession();
  const { activeTitleSlug } = useActiveTitle();
  const title = titleMeta(activeTitleSlug ?? 'apex');
  const accent = titleColors(title.slug);
  const { data, isLoading } = useDashboard(userId, title.slug);
  const queryClient = useQueryClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle().then(({ data }) => {
      setIsAdmin(!!data?.is_admin);
    });
  }, [userId]);

  async function handleSignOut() {
    const confirmed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        // Alert.alert renders nothing on web — react-native-web has no
        // native dialog to back it with, so this app's one other platform
        // needs its own real (browser-native) confirm popup.
        resolve(window.confirm('Are you sure you want to sign out?'));
        return;
      }
      Alert.alert('Sign out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-up');
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    const result = await deleteAccount();
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    // The account (and its session, server-side) is already gone — a local
    // sign-out just clears the on-device session without depending on a
    // server round trip for a user that no longer exists.
    await supabase.auth.signOut({ scope: 'local' });
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
        <Pressable onPress={() => router.push('/(auth)/choose-game')} style={styles.gameSwitchRow}>
          {({ hovered }: any) => (
            <View style={[styles.gameSwitchInner, hovered && { borderColor: accent.accentBorder }]}>
              <View style={[styles.gameSwitchDot, { backgroundColor: accent.accent }]} />
              <Text style={styles.gameSwitchLabel}>{title.name.toUpperCase()}</Text>
              <Text style={styles.gameSwitchChevron}>SWITCH →</Text>
            </View>
          )}
        </Pressable>

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
              <Text style={styles.verifiedHeaderLabel}>{title.slug === 'apex' ? 'EA VERIFIED' : `${title.name.toUpperCase()} VERIFIED`}</Text>
            </View>
            {(data.stats?.kd != null || data.stats?.wins != null || data.stats?.rankName) && (
              <StatGrid
                stats={[
                  { value: data.stats?.kd != null ? data.stats.kd.toFixed(2) : '—', label: 'K/D' },
                  { value: data.stats?.wins != null ? String(data.stats.wins) : '—', label: 'WINS' },
                  { value: data.stats?.rankName ?? '—', label: 'RANK' },
                ]}
              />
            )}
            <Text style={styles.helpText}>
              {data.stats?.fetchedAt ? `Synced ${formatRelativeTime(data.stats.fetchedAt)}` : 'Account verified.'}
            </Text>
          </HudPanel>
        ) : (
          <HudPanel contentStyle={{ padding: 20, gap: 14 }} strokeColor={accent.accentBorder}>
            <Text style={[styles.eyebrow, { color: color.textPrimary }]}>Link your {title.name} account</Text>
            <Text style={styles.linkCopy}>
              {title.verificationAvailable
                ? "You skipped this earlier — link it now so your stats are read, not entered by hand."
                : `Automatic verification for ${title.name} is coming soon.`}
            </Text>
            <Pressable onPress={() => router.push({ pathname: '/(auth)/link-account', params: { title: title.slug } })}>
              {({ pressed, hovered }: any) => (
                <View style={[styles.linkButton, { backgroundColor: pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary, borderColor: color.textPrimary }]}>
                  <Text style={[styles.linkButtonLabel, { color: color.base }]}>{title.verificationAvailable ? 'Link account' : 'Browse leagues instead'}</Text>
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
                <View style={styles.settingsLabelRow}>
                  <Ionicons name="notifications-outline" size={16} color={color.textPrimary} />
                  <Text style={styles.settingsLabel}>Notifications</Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/reset-password')}>
            {({ hovered }: any) => (
              <View style={[styles.settingsRow, hovered && { borderColor: color.hairlineStrong }]}>
                <View style={styles.settingsLabelRow}>
                  <Ionicons name="key-outline" size={16} color={color.textPrimary} />
                  <Text style={styles.settingsLabel}>Change password</Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/privacy')}>
            {({ hovered }: any) => (
              <View style={[styles.settingsRow, hovered && { borderColor: color.hairlineStrong }]}>
                <View style={styles.settingsLabelRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={color.textPrimary} />
                  <Text style={styles.settingsLabel}>Privacy Policy</Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/terms')}>
            {({ hovered }: any) => (
              <View style={[styles.settingsRow, hovered && { borderColor: color.hairlineStrong }]}>
                <View style={styles.settingsLabelRow}>
                  <Ionicons name="document-text-outline" size={16} color={color.textPrimary} />
                  <Text style={styles.settingsLabel}>Terms of Service</Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </View>
            )}
          </Pressable>
          {isAdmin && (
            <Pressable onPress={() => router.push('/(admin)/leagues')}>
              {({ hovered }: any) => (
                <View style={[styles.settingsRow, hovered && { borderColor: color.hairlineStrong }]}>
                  <View style={styles.settingsLabelRow}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={color.textPrimary} />
                    <Text style={styles.settingsLabel}>Admin console</Text>
                  </View>
                  <Text style={styles.chevron}>→</Text>
                </View>
              )}
            </Pressable>
          )}
          {confirmingDelete ? (
            <View style={styles.deleteConfirmBox}>
              <PasswordConfirmPanel
                label="DELETE ACCOUNT"
                warning="This permanently deletes your account — your profile, stats, and team memberships. Leagues and match results you're attributed to are kept, with your name removed. This can't be undone."
                confirmLabel="Delete account"
                onCancel={() => {
                  setConfirmingDelete(false);
                  setDeleteError(null);
                }}
                onConfirmed={handleDeleteAccount}
              />
              {deleteError && <Text style={styles.deleteErrorText}>{deleteError}</Text>}
            </View>
          ) : (
            <Pressable onPress={() => setConfirmingDelete(true)}>
              {({ hovered }: any) => (
                <View style={[styles.settingsRow, hovered && { borderColor: color.emberBorderStrong }]}>
                  <View style={styles.settingsLabelRow}>
                    <Ionicons name="trash-outline" size={16} color={color.ember} />
                    <Text style={[styles.settingsLabel, { color: color.ember }]}>Delete account</Text>
                  </View>
                  <Text style={[styles.chevron, { color: color.ember }]}>→</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        <Pressable onPress={handleSignOut}>
          {({ hovered }: any) => (
            <View style={[styles.signOutRow, hovered && { borderColor: color.hairlineStrong }]}>
              <Ionicons name="log-out-outline" size={16} color={color.textMuted} />
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
  gameSwitchRow: { alignSelf: 'flex-start' },
  gameSwitchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: color.hairline,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  gameSwitchDot: { width: 7, height: 7, borderRadius: 3.5 },
  gameSwitchLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.1 * 10, color: color.textPrimary },
  gameSwitchChevron: { fontFamily: fontFamily.interMedium, fontSize: 10, color: color.textMuted },
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
  settingsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  chevron: { fontFamily: fontFamily.interRegular, fontSize: 16, color: color.textMuted },
  deleteConfirmBox: { padding: 16, gap: 12, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel },
  deleteErrorText: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.ember },
  signOutRow: { flexDirection: 'row', gap: 8, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.hairline },
  signOutLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textMuted },
});
