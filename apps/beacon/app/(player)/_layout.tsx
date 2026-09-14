import { Stack } from 'expo-router';
import { RequireSession } from '../../components/RequireSession';

export default function PlayerLayout() {
  return (
    <RequireSession>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireSession>
  );
}
