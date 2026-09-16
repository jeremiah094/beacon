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

/** Registers this device for push and upserts the Expo push token into
 * push_tokens (BUILD.md §5) — call once per authenticated session. Reads
 * extra.eas.projectId (app.json); no-ops gracefully rather than throwing
 * if that's ever missing (e.g. a fork that hasn't linked its own project). */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    // Web push needs its own VAPID setup (out of scope — BUILD.md's push
    // requirement is iOS/Android), and expo-device can't detect
    // simulator/emulator status on web the way it does natively.
    if (!userId || Platform.OS === 'web' || !Device.isDevice) return;

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
