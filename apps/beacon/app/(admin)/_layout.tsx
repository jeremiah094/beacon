import { Stack } from 'expo-router';
import { RequireSession } from '../../components/RequireSession';

// Web-first desktop console — sidebar chrome added in task 9.
export default function AdminLayout() {
  return (
    <RequireSession>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireSession>
  );
}
