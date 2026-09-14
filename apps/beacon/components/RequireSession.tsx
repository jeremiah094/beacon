import { ReactNode } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Spinner } from './Spinner';
import { color } from '../theme/tokens';
import { useSession } from '../lib/hooks/useSession';

/** Guards every (player)/(admin) route: without this, a signed-out visitor
 * hitting a deep link directly (no session, refresh, shared URL) sees a
 * blank/broken screen instead of landing on sign-in — the queries that
 * need userId just never fire. Mirrors the loading-gate in app/index.tsx
 * so a session already in storage isn't mistaken for "signed out" during
 * the brief async check. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.base, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={20} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-up" />;
  }

  return <>{children}</>;
}
