import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { Diamond } from '../../components/Diamond';
import { Logo } from '../../components/Logo';
import { HudPanel } from '../../components/Panel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatGrid } from '../../components/StatGrid';
import { StatusBadge } from '../../components/StatusBadge';
import { Spinner } from '../../components/Spinner';
import { CornerCut } from '../../components/CornerCut';
import { color, fontFamily } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { ApexLinkStats, ApexPlatform, PLATFORM_OPTIONS, linkApexId } from '../../lib/api/apexLink';

// Reference: Beacon 01 Sign Up.dc.html. The prototype's phase machine
// (form/verifying/verified) is preserved; `confirmEmail` is added because
// this build talks to real Supabase auth, where sign-up may require email
// confirmation before a session exists to attribute the Apex link to.
type Phase = 'form' | 'confirmEmail' | 'linking' | 'verifying' | 'verified' | 'forgotPassword' | 'resetSent';
type IdType = 'ea' | 'apex';
type Mode = 'signUp' | 'signIn';

export default function SignUp() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [idType, setIdType] = useState<IdType>('ea');
  const [platform, setPlatform] = useState<ApexPlatform>('PC');
  const [gamerId, setGamerId] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [authError, setAuthError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [stats, setStats] = useState<ApexLinkStats | null>(null);

  const isSignIn = mode === 'signIn';
  const isEa = idType === 'ea';
  const gamerIdShown = gamerId.trim() || 'your account';

  // Linking a gaming ID is optional everywhere — filling it in still runs
  // the real verification; leaving it blank just skips straight through
  // (and is always reachable again later via sign-in, which re-checks
  // apex_verified_at and drops an unlinked account back on this step).
  const linkReady = gamerId.trim().length >= 3;

  const missing: string[] = [];
  if (phase !== 'linking') {
    if (!/^\S+@\S+\.\S+$/.test(email)) missing.push('a valid email address');
    if (password.length < 8) missing.push('a password of 8 characters or more');
  }
  const ready = missing.length === 0;
  const emailValid = /^\S+@\S+\.\S+$/.test(email);

  let blockedReason = '';
  if (missing.length === 1) blockedReason = `Still needed: ${missing[0]}.`;
  else if (missing.length > 1) {
    blockedReason = `Still needed: ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}.`;
  }

  async function runLink(onFailurePhase: Phase = 'form') {
    setPhase('verifying');
    setLinkError(null);
    const result = await linkApexId(gamerId.trim(), platform);
    if (result.ok) {
      setStats(result.stats);
      setPhase('verified');
    } else {
      setLinkError(result.message);
      setPhase(onFailurePhase);
    }
  }

  async function submitAccount(attemptLink: boolean) {
    setAuthError(null);
    const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (data.session) {
      if (attemptLink) await runLink();
      else router.replace('/(player)/stats');
    } else {
      setPhase('confirmEmail');
    }
  }

  // Discord OAuth only redirects usefully on web today (same constraint as
  // the email-confirmation and password-reset links elsewhere in this
  // file — detectSessionInUrl in lib/supabase.ts is only turned on for
  // web, so there's nothing native-side to pick the session back up).
  // Discord creates the account automatically on first sign-in, so this
  // one button covers both sign-in and sign-up.
  async function handleDiscordSignIn() {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) setAuthError(error.message);
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
      const userId = data.user?.id;
      const { data: profile } = userId
        ? await supabase.from('profiles').select('apex_verified_at, is_admin').eq('id', userId).maybeSingle()
        : { data: null };
      if (profile?.is_admin) {
        router.replace('/(admin)/leagues');
      } else if (profile?.apex_verified_at) {
        router.replace('/(player)/stats');
      } else {
        // Confirmed and signed in, but never finished (or skipped) linking
        // a gaming ID — offer it again, still skippable from here too.
        setPhase('linking');
      }
    } else if (phase === 'form') {
      if (!ready) return;
      await submitAccount(linkReady);
    } else if (phase === 'confirmEmail') {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (linkReady) await runLink();
        else router.replace('/(player)/stats');
      } else {
        setAuthError('Still waiting on that confirmation — check your inbox, then try again.');
      }
    } else if (phase === 'linking') {
      if (!linkReady) return;
      await runLink('linking');
    } else if (phase === 'verified') {
      router.replace('/(player)/stats');
    }
  }

  async function skipLinking() {
    if (phase === 'linking') {
      router.replace('/(player)/stats');
      return;
    }
    // phase === 'form': create the account (if not already) without
    // attempting to link — same path as leaving the gaming-ID field blank.
    if (!ready) return;
    await submitAccount(false);
  }

  function startOver() {
    setPhase('form');
    setLinkError(null);
    setAuthError(null);
    setStats(null);
  }

  const primary = primaryFor(phase, ready, isSignIn, linkReady, emailValid);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmarkBlock}>
          <View style={styles.wordmarkRow}>
            <Logo size={28} />
            <Text style={styles.wordmark}>BEACON</Text>
          </View>
          <Text style={styles.tagline}>Ireland's Apex Legends league</Text>
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

            {Platform.OS === 'web' && (
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
            )}

            {!isSignIn && (
              <GamingIdPanel
                idType={idType}
                setIdType={setIdType}
                platform={platform}
                setPlatform={setPlatform}
                gamerId={gamerId}
                setGamerId={setGamerId}
              />
            )}
          </View>
        )}

        {phase === 'linking' && (
          <View style={{ gap: 22, paddingTop: 12 }}>
            <Text style={styles.heading}>One step left</Text>
            <Text style={styles.bodyCopy}>
              Your email's confirmed — now link a gaming ID so your stats are read, not entered by hand.
            </Text>
            <GamingIdPanel
              idType={idType}
              setIdType={setIdType}
              platform={platform}
              setPlatform={setPlatform}
              gamerId={gamerId}
              setGamerId={setGamerId}
            />
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

        {phase === 'verifying' && (
          <View style={{ gap: 24, paddingTop: 40 }}>
            <Spinner size={16} strokeColor={color.textMuted} />
            <Text style={styles.heading}>Checking with EA</Text>
            <Text style={styles.bodyCopy}>
              Matching <Text style={{ color: color.textPrimary }}>{gamerIdShown}</Text> against Apex Legends
              ranked records. This takes a few seconds.
            </Text>
          </View>
        )}

        {phase === 'verified' && stats && (
          <View style={{ gap: 22, paddingTop: 24 }}>
            <StatusBadge variant="verified" label="EA VERIFIED" />
            <Text style={styles.headingLarge}>Account linked</Text>
            <Text style={styles.bodyCopy}>Everything below was read from your account, not entered by hand.</Text>
            <HudPanel variant="verified" contentStyle={{ padding: 20, gap: 16 }}>
              <View style={{ gap: 3 }}>
                <Text style={styles.gamerIdHeading}>{gamerIdShown}</Text>
                <Text style={styles.platformLine}>{PLATFORM_OPTIONS.find((p) => p.value === stats.platform)?.label ?? stats.platform}</Text>
              </View>
              <StatGrid
                stats={[
                  { value: stats.kd != null ? stats.kd.toFixed(2) : '—', label: 'K/D' },
                  { value: stats.wins != null ? String(stats.wins) : '—', label: 'WINS' },
                  { value: stats.rankName ?? '—', label: 'RANK' },
                ]}
              />
              <Text style={styles.helpText}>Eligible for Division One and below.</Text>
            </HudPanel>
          </View>
        )}
      </ScrollView>

      <View style={styles.dockedFooter}>
        {(phase === 'form' || phase === 'linking') && !ready ? (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={styles.noteText}>{blockedReason}</Text>
          </View>
        ) : null}
        {(authError || linkError) && phase !== 'verifying' ? (
          <View style={styles.noteRow}>
            <View style={styles.noteBar} />
            <Text style={[styles.noteText, { color: color.textPrimary }]}>{authError ?? linkError}</Text>
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

        {((phase === 'form' && !isSignIn) || phase === 'linking') && (
          <Pressable onPress={skipLinking}>
            <Text style={styles.skipLabel}>
              {phase === 'linking' ? 'Skip for now' : 'Skip linking for now'} — you can link later by signing back in
            </Text>
          </Pressable>
        )}
        {phase === 'form' && !isSignIn && (
          <Text style={styles.finePrint}>
            Continuing links your EA account data to Beacon for stat verification. We read match and rank
            data only, and never post on your behalf.
          </Text>
        )}
        {phase === 'verified' && (
          <Pressable onPress={startOver}>
            <Text style={styles.startOver}>Start over</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function primaryFor(phase: Phase, ready: boolean, isSignIn: boolean, linkReady: boolean, emailValid: boolean) {
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
  if (phase === 'verifying') {
    return {
      label: 'Verifying…',
      bg: color.fillMutedStrong,
      fg: color.textMuted,
      border: 'transparent',
      disabled: true,
    };
  }
  if (phase === 'verified') {
    return {
      label: 'Continue to your dashboard',
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
  if (phase === 'linking') {
    return linkReady
      ? {
          label: 'Link account',
          bg: color.textPrimary,
          fg: color.base,
          border: color.textPrimary,
          hoverBg: color.fillHover,
          activeBg: color.fillActive,
          disabled: false,
        }
      : {
          label: 'Link account',
          bg: color.fillMuted,
          fg: 'rgba(242,241,236,0.35)',
          border: color.fillMutedBorder,
          disabled: true,
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

function GamingIdPanel({
  idType,
  setIdType,
  platform,
  setPlatform,
  gamerId,
  setGamerId,
}: {
  idType: IdType;
  setIdType: (v: IdType) => void;
  platform: ApexPlatform;
  setPlatform: (v: ApexPlatform) => void;
  gamerId: string;
  setGamerId: (v: string) => void;
}) {
  const isEa = idType === 'ea';
  return (
    <HudPanel contentStyle={{ padding: 20, gap: 16 }}>
      <View style={styles.linkHeaderRow}>
        <Text style={[styles.eyebrow, { color: color.textPrimary }]}>Link your gaming ID</Text>
        <View style={styles.requiredChip}>
          <Text style={styles.requiredChipLabel}>RECOMMENDED</Text>
        </View>
      </View>

      <Text style={styles.linkCopy}>
        Beacon reads your rank, K/D and wins straight from your account, so every stat in the league is
        verified rather than self-reported. It also confirms you're eligible to play — you can skip this
        for now and link it later.
      </Text>

      <SegmentedControl
        height={44}
        options={[
          { value: 'ea', label: 'EA Play ID' },
          { value: 'apex', label: 'Apex Legends ID' },
        ]}
        value={idType}
        onChange={setIdType}
      />

      <View style={{ gap: 8 }}>
        <Text style={styles.platformLabel}>Platform</Text>
        <SegmentedControl height={40} options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} />
        <Text style={styles.helpText}>
          Whichever platform your account is actually on — cross-play doesn't change which one holds your stats.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <TextInput
          value={gamerId}
          onChangeText={setGamerId}
          placeholder={isEa ? 'EA Play ID · e.g. VipersKane_IE' : 'Apex Legends ID · e.g. VipersKane'}
          autoCapitalize="none"
          placeholderTextColor={color.fillPlaceholder}
          style={[styles.bareInput, { backgroundColor: color.base }]}
        />
        <Text style={styles.helpText}>
          {isEa
            ? 'Found in the EA app under your profile name.'
            : 'Shown in the top-left of the Apex Legends lobby, under your banner.'}
        </Text>
      </View>

      <View style={styles.verifiedFooterRow}>
        <Diamond size={8} color={color.verified} />
        <Text style={styles.verifiedFooterLabel}>STATS FROM A LINKED ACCOUNT CARRY THIS MARK</Text>
      </View>
    </HudPanel>
  );
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
  linkHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  requiredChip: { borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 4, paddingHorizontal: 8 },
  requiredChipLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.12 * 10,
    color: color.textPrimary,
  },
  linkCopy: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19.5, color: color.textMuted },
  helpText: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  platformLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  platformLine: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted },
  verifiedFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    paddingTop: 14,
  },
  verifiedFooterLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    color: color.verified,
  },
  heading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, lineHeight: 32, color: color.textPrimary },
  headingLarge: { fontFamily: fontFamily.rajdhaniBold, fontSize: 32, lineHeight: 34, color: color.textPrimary },
  gamerIdHeading: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 20, color: color.textPrimary },
  bodyCopy: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 21, color: color.textMuted },
  dockedFooter: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, gap: 12 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  primaryOuter: { height: 52, width: '100%' },
  primaryContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15 },
  finePrint: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 16.5, color: color.textMuted, textAlign: 'center' },
  skipLabel: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  startOver: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textMuted, textAlign: 'center' },
});
