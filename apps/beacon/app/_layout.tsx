import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
