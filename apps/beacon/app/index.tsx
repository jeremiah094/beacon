import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Spinner } from '../components/Spinner';
import { LandingPage } from '../components/marketing/LandingPage';
import { color } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useActiveTitle } from '../lib/hooks/useActiveTitle';

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recovery, setRecovery] = useState(false);
  // Cold launch with an already-persisted session is what "logging in" on
  // native actually looks like — this used to redirect straight into the
  // Apex-shaped /(player)/stats regardless of whether the player had ever
  // picked a game, silently defaulting every unchosen player to Apex.
  const { activeTitleSlug, loaded: titleLoaded } = useActiveTitle();

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

  // isAdmin only resolves once userId does, so waiting on titleLoaded too
  // (rather than gating on it separately) never redirects an admin off to
  // choose-game just because AsyncStorage hasn't answered yet.
  if (!checked || (userId && !isAdmin && !titleLoaded)) {
    return (
      <View style={{ flex: 1, backgroundColor: color.base, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={20} />
      </View>
    );
  }

  if (!userId) {
    // Web's logged-out homepage is a real marketing page, not a redirect —
    // beaconproject.eu itself is the landing page. Native has no public
    // web presence to advertise on, so it goes straight to sign-in.
    if (Platform.OS === 'web') return <LandingPage />;
    return <Redirect href="/(auth)/sign-up" />;
  }
  if (isAdmin) return <Redirect href="/(admin)/leagues" />;
  // No game picked yet on this device — land on the chooser instead of
  // silently defaulting into Apex. Once a title's been picked it's
  // remembered (useActiveTitle/AsyncStorage), so this only fires once
  // per device, not on every launch.
  return <Redirect href={activeTitleSlug ? '/(player)/stats' : '/(auth)/choose-game'} />;
}
