import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Diamond } from '../../components/Diamond';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily } from '../../theme/tokens';
import { formatRelativeTime } from '../../lib/time';
import { useSession } from '../../lib/hooks/useSession';
import { registerWebPush, usePushRegistration } from '../../lib/hooks/usePushRegistration';
import { AppNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../lib/api/notifications';

const isWeb = Platform.OS === 'web';

// Reference: Beacon 10 Push Notifications.dc.html. The source shows OS
// lock-screen and banner mockups — that's not a real in-app screen (no app
// renders a fake lock screen inside itself), so this is the screen it
// actually implies: notification settings, with the same copy and the
// same ember-vs-neutral distinction the mockups establish. The actual
// notification content lives in supabase/functions/match-notify.
export default function NotificationSettings() {
  const { userId } = useSession();
  const [status, setStatus] = useState<NotificationPermission | Notifications.PermissionStatus | null>(null);
  const { data: notifications, isLoading: notificationsLoading } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);

  usePushRegistration(userId);

  useEffect(() => {
    if (isWeb) {
      if (typeof Notification !== 'undefined') setStatus(Notification.permission);
      return;
    }
    Notifications.getPermissionsAsync().then((r) => setStatus(r.status));
  }, []);

  async function handleEnable() {
    if (isWeb) {
      if (userId) await registerWebPush(userId);
      if (typeof Notification !== 'undefined') setStatus(Notification.permission);
      return;
    }
    const r = await Notifications.requestPermissionsAsync();
    setStatus(r.status);
  }

  const granted = status === 'granted';
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  async function handleTapNotification(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.url) router.push(n.url as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>NOTIFICATIONS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 12 }}>
          <View style={styles.inboxHeaderRow}>
            <Text style={styles.sectionLabel}>Inbox</Text>
            {unreadCount > 0 && (
              <Pressable onPress={() => markAllRead.mutate()}>
                <Text style={styles.markAllLabel}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          {notificationsLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Spinner size={18} />
            </View>
          ) : !notifications || notifications.length === 0 ? (
            <Text style={styles.emptyInboxText}>Nothing yet — game and match updates will show up here.</Text>
          ) : (
            <View style={{ gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline }}>
              {notifications.map((n) => (
                <Pressable key={n.id} onPress={() => handleTapNotification(n)}>
                  {({ hovered }: any) => (
                    <View style={[styles.inboxRow, hovered && { backgroundColor: 'rgba(242,241,236,0.04)' }]}>
                      {!n.read && <View style={styles.unreadDot} />}
                      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                        <Text style={[styles.inboxTitle, !n.read && { color: color.textPrimary }]}>{n.title}</Text>
                        <Text style={styles.inboxBody} numberOfLines={2}>{n.body}</Text>
                        <Text style={styles.inboxTime}>{formatRelativeTime(n.createdAt)}</Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 6 }]}>Push settings</Text>
        <View style={styles.statusBox}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: granted ? color.verified : color.textMuted }]} />
            <Text style={styles.statusText}>{granted ? 'Push notifications are on' : 'Push notifications are off'}</Text>
          </View>
          {!granted && (
            <Pressable onPress={handleEnable}>
              {({ pressed, hovered }: any) => (
                <View style={[styles.enableButton, { backgroundColor: pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary }]}>
                  <Text style={styles.enableLabel}>Enable notifications</Text>
                </View>
              )}
            </Pressable>
          )}
          {isWeb && (
            <Text style={styles.webHint}>Your browser will ask to allow notifications from beaconproject.eu.</Text>
          )}
        </View>

        <ExampleCard
          tone="ember"
          title="Lobby opens in 10 minutes"
          body="Match 9 · Game 2 · Division One. Lineups are locked as of now. Tap to open your lobby code."
        />
        <ExampleCard
          tone="neutral"
          title="New game scheduled"
          body="Beacon Division One added Match 10 · Game 1 — Tuesday 8 September at 20:00, Storm Point. 20-team lobby."
        />

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>How these work</Text>
          <Text style={styles.noteBody}>
            Match starting soon fires exactly 10 minutes before a game's lobby opens — the same moment your lineup
            locks — and opens straight to your lobby code. New game scheduled fires the moment a league admin
            publishes a fixture.
          </Text>
          <Text style={styles.noteBody}>
            You can mute a single game from its card on Upcoming Games without turning notifications off entirely.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExampleCard({ tone, title, body }: { tone: 'ember' | 'neutral'; title: string; body: string }) {
  const isEmber = tone === 'ember';
  return (
    <View style={[styles.exampleCard, { borderColor: isEmber ? color.emberBorderSoft : color.hairline }]}>
      <View style={[styles.exampleIcon, isEmber ? { backgroundColor: color.ember } : { borderWidth: 1, borderColor: color.hairlineStrong }]}>
        <Diamond size={14} color={isEmber ? color.base : color.textPrimary} />
      </View>
      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
        <View style={styles.exampleHeaderRow}>
          <Text style={[styles.exampleBrand, { color: isEmber ? color.ember : color.textMuted }]}>BEACON</Text>
        </View>
        <Text style={styles.exampleTitle}>{title}</Text>
        <Text style={styles.exampleBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  header: { padding: 22, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 18, color: color.textMuted },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, letterSpacing: 0.01 * 28, color: color.textPrimary },
  content: { padding: 22, paddingTop: 18, gap: 14 },
  sectionLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.12 * 11, textTransform: 'uppercase', color: color.textMuted },
  inboxHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  markAllLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  emptyInboxText: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 18, color: color.textMuted, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 16 },
  inboxRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, paddingHorizontal: 16, backgroundColor: color.panel },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: color.ember },
  inboxTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textMuted },
  inboxBody: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  inboxTime: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted, marginTop: 2 },
  statusBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 16, gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  statusText: { flex: 1, fontFamily: fontFamily.interSemiBold, fontSize: 14, lineHeight: 19, color: color.textPrimary },
  enableButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  enableLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.base },
  webHint: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  exampleCard: { flexDirection: 'row', gap: 12, borderWidth: 1, backgroundColor: color.panel, padding: 15, paddingHorizontal: 16 },
  exampleIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  exampleHeaderRow: { flexDirection: 'row' },
  exampleBrand: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10 },
  exampleTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 15, lineHeight: 19, color: color.textPrimary },
  exampleBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 18.5, color: color.textMuted },
  noteBox: { gap: 12, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 16, marginTop: 4 },
  noteTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.12 * 11, color: color.textPrimary, textTransform: 'uppercase' },
  noteBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted },
});
