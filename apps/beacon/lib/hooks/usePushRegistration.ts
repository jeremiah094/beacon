import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Idempotent — safe to call from usePushRegistration's mount effect and
 * again from the Notifications screen's "Enable" button (e.g. after a
 * user re-grants a previously denied permission). Re-checks permission
 * status itself each time rather than assuming the caller already did. */
export async function registerWebPush(userId: string) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn('registerWebPush: no VAPID public key configured — skipping.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/beacon-sw.js');

    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      }));

    await supabase
      .from('push_tokens')
      .upsert({ profile_id: userId, token: JSON.stringify(subscription), platform: 'web' }, { onConflict: 'profile_id,token' });
  } catch (err) {
    console.warn('registerWebPush failed', err);
  }
}

/** Registers this device for push and upserts a token into push_tokens
 * (BUILD.md §5) — call once per authenticated session. Native uses Expo's
 * push service (extra.eas.projectId from app.json); web uses the browser's
 * own Push API against the VAPID key pair (match-notify holds the private
 * half as an Edge Function secret). Either way it no-ops gracefully rather
 * than throwing if something's unavailable — a device without push
 * capability just doesn't get a token, nothing else breaks. */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === 'web') {
      registerWebPush(userId);
      return;
    }
    // expo-device can't detect simulator/emulator status on web the way it
    // does natively — the web branch above already returned.
    if (!Device.isDevice) return;

    let cancelled = false;

    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted' || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('usePushRegistration: no EAS projectId configured yet — skipping token registration.');
        return;
      }

      const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
      if (cancelled || !pushToken.data) return;

      await supabase
        .from('push_tokens')
        .upsert({ profile_id: userId, token: pushToken.data, platform: Platform.OS }, { onConflict: 'profile_id,token' });
    })().catch((err) => console.warn('usePushRegistration failed', err));

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/** BUILD.md §5: the T-10m push deep-links straight to the match lobby
 * (screen 09), not app home. Tapping a notification fires a "response"
 * event with the `data.url` we set in the match-notify function. */
export function useNotificationDeepLinks() {
  useEffect(() => {
    // Same web scope-out as usePushRegistration above — there's no push
    // subscription on web to have delivered a notification response from,
    // and getLastNotificationResponseAsync throws there.
    if (Platform.OS === 'web') return;

    function handle(response: Notifications.NotificationResponse) {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) {
        const path = url.replace(/^beacon:\/\//, '/');
        router.push(path as any);
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handle(response);
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
}
