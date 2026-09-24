import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CornerCut } from '../components/CornerCut';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/Spinner';
import { color, fontFamily } from '../theme/tokens';
import { supabase } from '../lib/supabase';

type Phase = 'waiting' | 'ready' | 'saving' | 'done' | 'expired';

// Reached two ways: a Supabase password-recovery email link (which lands
// here because index.tsx watches for the PASSWORD_RECOVERY auth event
// and redirects here instead of into the app), or in-app navigation from
// an already-signed-in account (profile.tsx / admin settings.tsx "Change
// password"). Either way the action is identical — set a new password on
// whatever session exists — so one screen serves both.
export default function ResetPassword() {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPhase((p) => (p === 'waiting' ? 'ready' : p));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setPhase((p) => (p === 'waiting' ? 'ready' : p));
    });
    const timeout = setTimeout(() => setPhase((p) => (p === 'waiting' ? 'expired' : p)), 8000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const missing: string[] = [];
  if (password.length < 8) missing.push('a password of 8 characters or more');
  else if (password !== confirm) missing.push("passwords that match");
  const ready = missing.length === 0;

  async function handleSubmit() {
    if (!ready) return;
    setError(null);
    setPhase('saving');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setPhase('ready');
      return;
    }
    setPhase('done');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmarkRow}>
          <Logo size={28} />
          <Text style={styles.wordmark}>BEACON</Text>
        </View>

        {phase === 'waiting' && (
          <View style={{ gap: 20, paddingTop: 30, alignItems: 'flex-start' }}>
            <Spinner size={16} strokeColor={color.textMuted} />
            <Text style={styles.heading}>Confirming your link</Text>
            <Text style={styles.bodyCopy}>Give it a moment — this only takes a second.</Text>
          </View>
        )}

        {phase === 'expired' && (
          <View style={{ gap: 16, paddingTop: 30 }}>
            <Text style={styles.heading}>That link's expired</Text>
            <Text style={styles.bodyCopy}>
              Password reset links only last a little while. Head back to sign in and request a fresh one.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/sign-up')}>
              <Text style={styles.linkText}>Back to sign in</Text>
            </Pressable>
          </View>
        )}

        {(phase === 'ready' || phase === 'saving') && (
          <View style={{ gap: 20, paddingTop: 12 }}>
            <Text style={styles.heading}>Set a new password</Text>
            <Text style={styles.bodyCopy}>Choose a new password for your account.</Text>
            <View style={{ gap: 10 }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="New password · 8 characters min"
                secureTextEntry
                placeholderTextColor={color.fillPlaceholder}
                style={styles.bareInput}
              />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm new password"
                secureTextEntry
                placeholderTextColor={color.fillPlaceholder}
                style={styles.bareInput}
              />
            </View>
            {error && (
              <View style={styles.noteRow}>
                <View style={styles.noteBar} />
                <Text style={styles.noteText}>{error}</Text>
              </View>
            )}
          </View>
        )}

        {phase === 'done' && (
          <View style={{ gap: 16, paddingTop: 30 }}>
            <Text style={styles.heading}>Password updated</Text>
            <Text style={styles.bodyCopy}>You're all set — continue into Beacon.</Text>
          </View>
        )}
      </ScrollView>

      {(phase === 'ready' || phase === 'saving') && (
        <View style={styles.dockedFooter}>
          <Pressable onPress={handleSubmit} disabled={!ready || phase === 'saving'}>
            <CornerCut
              cut={10}
              fill={!ready || phase === 'saving' ? color.fillMuted : color.textPrimary}
              strokeColor={!ready || phase === 'saving' ? color.fillMutedBorder : color.textPrimary}
              style={styles.primaryOuter}
            >
              <View style={styles.primaryContent}>
                {phase === 'saving' ? (
                  <Spinner size={14} strokeColor={color.base} />
                ) : (
                  <Text style={[styles.primaryLabel, { color: ready ? color.base : 'rgba(242,241,236,0.35)' }]}>Update password</Text>
                )}
              </View>
            </CornerCut>
          </Pressable>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.dockedFooter}>
          <Pressable onPress={() => router.replace('/')}>
            <CornerCut cut={10} fill={color.textPrimary} strokeColor={color.textPrimary} style={styles.primaryOuter}>
              <View style={styles.primaryContent}>
                <Text style={[styles.primaryLabel, { color: color.base }]}>Continue</Text>
              </View>
            </CornerCut>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  scroll: { padding: 22, paddingTop: 12, gap: 26, flexGrow: 1 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 34, letterSpacing: 0.06 * 34, color: color.textPrimary },
  heading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, lineHeight: 32, color: color.textPrimary },
  bodyCopy: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 21, color: color.textMuted },
  bareInput: {
    height: 50,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    color: color.textPrimary,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textPrimary },
  linkText: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, gap: 12 },
  primaryOuter: { height: 52, width: '100%' },
  primaryContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
});
