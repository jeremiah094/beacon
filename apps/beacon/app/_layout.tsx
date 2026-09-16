import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useRajdhani,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { color } from '../theme/tokens';
import { useSession } from '../lib/hooks/useSession';
import { useNotificationDeepLinks, usePushRegistration } from '../lib/hooks/usePushRegistration';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

// React Query's refetch-on-focus only fires on native once it's told the
// app actually came back to the foreground — on web the browser's own
// window "focus" event already does this for free.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export default function RootLayout() {
  const [rajdhaniLoaded] = useRajdhani({
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const fontsReady = rajdhaniLoaded && interLoaded;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  if (!fontsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppShell />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.base },
          }}
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/** Session-scoped setup that has to live inside the providers above but
 * outside any one screen: push registration and notification-tap routing. */
function AppShell() {
  const { userId } = useSession();
  usePushRegistration(userId);
  useNotificationDeepLinks();
  return null;
}
