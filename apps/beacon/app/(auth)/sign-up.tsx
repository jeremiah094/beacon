import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AntDesign } from '@expo/vector-icons';
import { Logo } from '../../components/Logo';
import { CornerCut } from '../../components/CornerCut';
import { color, fontFamily } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';

// Reference: Beacon 01 Sign Up.dc.html. The prototype's form/verifying/
// verified phase machine lived here when this screen only ever linked an
// Apex account — now that Beacon spans multiple games, picking a
// game/linking an account is its own post-login flow (choose-game →
// link-account), so this screen only owns account creation/sign-in itself.
type Phase = 'form' | 'confirmEmail' | 'forgotPassword' | 'resetSent';
type Mode = 'signUp' | 'signIn';

export default function SignUp() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [authError, setAuthError] = useState<string | null>(null);

  const isSignIn = mode === 'signIn';

  const missing: string[] = [];
  if (!/^\S+@\S+\.\S+$/.test(email)) missing.push('a valid email address');
  if (password.length < 8) missing.push('a password of 8 characters or more');
  const ready = missing.length === 0;
  const emailValid = /^\S+@\S+\.\S+$/.test(email);

  let blockedReason = '';
  if (missing.length === 1) blockedReason = `Still needed: ${missing[0]}.`;
  else if (missing.length > 1) {
    blockedReason = `Still needed: ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}.`;
  }

  // Shared by the email/password sign-in branch below and the native
  // Discord flow — both land here with nothing more than a userId once a
  // session exists, whatever got them there. Which title's context they
  // land in (and whether that title still needs linking) is choose-game's
  // job, not this screen's.
  async function routeAfterSignIn(userId: string) {
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle();
    if (profile?.is_admin) {
      router.replace('/(admin)/leagues');
      return;
    }
    router.replace('/(auth)/choose-game');
  }

  async function submitAccount() {
    setAuthError(null);
    const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (data.session) {
      router.replace('/(auth)/choose-game');
    } else {
      setPhase('confirmEmail');
    }
  }

  // Discord creates the account automatically on first sign-in, so this
  // one button covers both sign-in and sign-up. Web does a full browser
  // redirect — detectSessionInUrl (lib/supabase.ts) picks the session up
  // once Supabase redirects back, same as the email-confirmation and
  // password-reset links elsewhere in this file. Native has no page URL
  // for that to work, so it opens an in-app browser session instead and
  // hands the returned tokens to the client directly.
  async function handleDiscordSignIn() {
    setAuthError(null);
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
      });
      if (error) setAuthError(error.message);
      return;
    }

    const redirectTo = Linking.createURL('/');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      setAuthError(error?.message ?? 'Could not start Discord sign-in.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) return; // cancelled — not an error

    const hashIndex = result.url.indexOf('#');
    const params = new URLSearchParams(hashIndex === -1 ? '' : result.url.slice(hashIndex + 1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) {
      setAuthError("Discord sign-in didn't complete — try again.");
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError || !sessionData.session) {
      setAuthError(sessionError?.message ?? "Discord sign-in didn't complete — try again.");
      return;
    }
    await routeAfterSignIn(sessionData.session.user.id);
  }

  async function sendResetEmail() {
    setAuthError(null);
    const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: emailRedirectTo });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setPhase('resetSent');
  }

  async function handlePrimary() {
    if (phase === 'forgotPassword') {
      if (!emailValid) return;
      await sendResetEmail();
    } else if (phase === 'resetSent') {
      setPhase('form');
      setMode('signIn');
    } else if (phase === 'form' && isSignIn) {
      if (!ready) return;
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (data.user?.id) await routeAfterSignIn(data.user.id);
    } else if (phase === 'form') {
      if (!ready) return;
      await submitAccount();
    } else if (phase === 'confirmEmail') {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/(auth)/choose-game');
      } else {
        setAuthError('Still waiting on that confirmation — check your inbox, then try again.');
      }
    }
  }

  const primary = primaryFor(phase, ready, isSignIn, emailValid);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmarkBlock}>
          <View style={styles.wordmarkRow}>
            <Logo size={28} />
            <Text style={styles.wordmark}>BEACON</Text>
          </View>
          <Text style={styles.tagline}>Ireland's esports league</Text>
        </View>

        {phase === 'form' && (
          <View style={{ gap: 26 }}>
            <View style={{ gap: 14 }}>
              <Text style={styles.eyebrow}>Your account</Text>
              <View style={{ gap: 10 }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.ie"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor={color.fillPlaceholder}
                  style={styles.bareInput}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password · 8 characters min"
                  secureTextEntry
                  placeholderTextColor={color.fillPlaceholder}
                  style={styles.bareInput}
                />
              </View>
              {isSignIn && (
                <Pressable onPress={() => { setPhase('forgotPassword'); setAuthError(null); }}>
                  <Text style={styles.forgotLabel}>Forgot password?</Text>
                </Pressable>
              )}
              <Pressable onPress={() => { setMode(isSignIn ? 'signUp' : 'signIn'); setAuthError(null); }}>
                <Text style={styles.modeToggle}>
                  {isSignIn ? "Need an account? " : 'Already have an account? '}
                  <Text style={{ color: color.textPrimary }}>{isSignIn ? 'Create one' : 'Sign in'}</Text>
                </Text>
              </Pressable>
            </View>

            <View style={{ gap: 16 }}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable onPress={handleDiscordSignIn}>
                {({ pressed, hovered }: any) => (
                  <View style={[styles.discordButton, (pressed || hovered) && { backgroundColor: color.fillHover }]}>
                    <AntDesign name="discord" size={18} color={color.textPrimary} />
                    <Text style={styles.discordButtonLabel}>Continue with Discord</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {!isSignIn && (
              <Text style={styles.finePrint}>
                After creating your account, you'll pick which game you're here for and can link your gaming
                account to verify your stats.
              </Text>
            )}
          </View>
        )}

        {phase === 'forgotPassword' && (
          <View style={{ gap: 22, paddingTop: 12 }}>
            <Text style={styles.heading}>Reset your password</Text>
            <Text style={styles.bodyCopy}>Enter your account email and we'll send you a link to set a new password.</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.ie"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={color.fillPlaceholder}
              style={styles.bareInput}
            />
            <Pressable onPress={() => { setPhase('form'); setAuthError(null); }}>
              <Text style={styles.modeToggle}>Back to sign in</Text>
            </Pressable>
          </View>
        )}

        {phase === 'resetSent' && (
          <View style={{ gap: 22, paddingTop: 24 }}>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.bodyCopy}>
              We sent a password reset link to <Text style={{ color: color.textPrimary }}>{email}</Text>. Open it
              to set a new password.
            </Text>
          </View>
        )}

        {phase === 'confirmEmail' && (
          <View style={{ gap: 22, paddingTop: 24 }}>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.bodyCopy}>
              We sent a confirmation link to <Text style={{ color: color.textPrimary }}>{email}</Text>. Open
              it, then come back here and continue.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        {phase === 'form' && !ready ? (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>{blockedReason}</Text>
          </View>
        ) : null}
        {authError ? (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={[styles.noteText, { color: color.textPrimary }]}>{authError}</Text>
          </View>
        ) : null}

        <Pressable onPress={handlePrimary} disabled={primary.disabled}>
          {({ pressed, hovered }: any) => (
            <CornerCut
              cut={10}
              fill={primary.disabled ? primary.bg : pressed ? primary.activeBg ?? primary.bg : hovered ? primary.hoverBg ?? primary.bg : primary.bg}
              strokeColor={primary.border}
              style={styles.primaryOuter}
            >
              <View style={styles.primaryContent}>
                <Text style={[styles.primaryLabel, { color: primary.fg }]}>{primary.label}</Text>
              </View>
            </CornerCut>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function primaryFor(phase: Phase, ready: boolean, isSignIn: boolean, emailValid: boolean) {
  if (phase === 'forgotPassword') {
    return emailValid
      ? {
          label: 'Send reset link',
          bg: color.textPrimary,
          fg: color.base,
          border: color.textPrimary,
          hoverBg: color.fillHover,
          activeBg: color.fillActive,
          disabled: false,
        }
      : {
          label: 'Send reset link',
          bg: color.fillMuted,
          fg: 'rgba(242,241,236,0.35)',
          border: color.fillMutedBorder,
          disabled: true,
        };
  }
  if (phase === 'resetSent') {
    return {
      label: 'Back to sign in',
      bg: color.textPrimary,
      fg: color.base,
      border: color.textPrimary,
      hoverBg: color.fillHover,
      activeBg: color.fillActive,
      disabled: false,
    };
  }
  if (phase === 'confirmEmail') {
    return {
      label: "I've confirmed — continue",
      bg: color.textPrimary,
      fg: color.base,
      border: color.textPrimary,
      hoverBg: color.fillHover,
      activeBg: color.fillActive,
      disabled: false,
    };
  }
  // form
  const label = isSignIn ? 'Sign in' : 'Create account';
  return ready
    ? {
        label,
        bg: color.textPrimary,
        fg: color.base,
        border: color.textPrimary,
        hoverBg: color.fillHover,
        activeBg: color.fillActive,
        disabled: false,
      }
    : {
        label,
        bg: color.fillMuted,
        fg: 'rgba(242,241,236,0.35)',
        border: color.fillMutedBorder,
        disabled: true,
      };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  scroll: { padding: 22, paddingTop: 12, gap: 26 },
  wordmarkBlock: { gap: 10 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 34,
    letterSpacing: 0.06 * 34,
    color: color.textPrimary,
  },
  tagline: { fontFamily: fontFamily.interRegular, fontSize: 14, color: color.textMuted },
  modeToggle: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  forgotLabel: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, textAlign: 'right' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: color.hairline },
  dividerLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.1 * 10, color: color.textMuted },
  discordButton: {
    height: 50,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  discordButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  eyebrow: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
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
  heading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, lineHeight: 32, color: color.textPrimary },
  bodyCopy: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 21, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, gap: 12 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  primaryOuter: { height: 52, width: '100%' },
  primaryContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
  finePrint: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16.5, color: color.textMuted, textAlign: 'center' },
});
