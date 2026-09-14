import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Spinner } from '../components/Spinner';
import { color } from '../theme/tokens';
import { supabase } from '../lib/supabase';

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
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

  return <Redirect href={hasSession ? '/(player)/stats' : '/(auth)/sign-up'} />;
}
