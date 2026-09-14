import { Redirect } from 'expo-router';

export default function Index() {
  // TODO(task 4): branch on Supabase auth session instead of always
  // sending players to sign-up.
  return <Redirect href="/(auth)/sign-up" />;
}
