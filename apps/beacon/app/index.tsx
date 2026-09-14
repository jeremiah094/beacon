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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
