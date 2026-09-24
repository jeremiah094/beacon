import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Spinner } from '../components/Spinner';
import { color } from '../theme/tokens';
import { supabase } from '../lib/supabase';

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (id) {
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', id).maybeSingle();
        setIsAdmin(!!profile?.is_admin);
      }
      setChecked(true);
    });
    // A password-recovery email link lands here (its redirectTo is just
    // the site origin) with a session Supabase already attached to the
    // URL — without this check that session would look like an ordinary
    // sign-in and redirect straight into the app, skipping the "set a new
    // password" step entirely.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        return;
      }
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (recovery) return <Redirect href="/reset-password" />;

  if (!checked) {
    return (
      <View style={{ flex: 1, backgroundColor: color.base, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={20} />
      </View>
    );
  }

  if (!userId) return <Redirect href="/(auth)/sign-up" />;
  return <Redirect href={isAdmin ? '/(admin)/leagues' : '/(player)/stats'} />;
}
