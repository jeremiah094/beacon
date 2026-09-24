import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Diamond } from '../Diamond';
import { Logo } from '../Logo';
import { HudPanel } from '../Panel';
import { CornerCut } from '../CornerCut';
import { color, fontFamily } from '../../theme/tokens';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'EA-verified stats',
    body: 'Link your EA or Apex Legends ID and your rank, K/D and wins are read straight from your account — not typed in by hand.',
  },
  {
    icon: 'people-outline',
    title: 'Team & lineup management',
    body: 'Build your roster, submit lineups before lock, and handle last-minute substitutions without leaving the app.',
  },
  {
    icon: 'radio-outline',
    title: 'Live match monitoring',
    body: 'Lobby codes, match status, and a live team checklist so nobody misses their game.',
  },
  {
    icon: 'trophy-outline',
    title: 'Standings that update themselves',
    body: 'Placements and kills feed straight into league standings the moment results are published.',
  },
  {
    icon: 'grid-outline',
    title: 'A real admin console',
    body: 'League organisers get scheduling, approvals, results verification and settings built for running a league — not a spreadsheet.',
  },
  {
    icon: 'logo-discord',
    title: 'Sign in your way',
    body: 'Email and password, or sign in with Discord — whichever is faster for you.',
  },
];

/** Beacon's logged-out web homepage — beaconproject.eu itself, not a
 * redirect target. Native skips this entirely and opens straight to
 * sign-in (see app/index.tsx). */
export function LandingPage() {
  function goToSignIn() {
    router.push('/(auth)/sign-up');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.nav}>
          <View style={styles.navBrand}>
            <Logo size={24} />
            <Text style={styles.wordmark}>BEACON</Text>
          </View>
          <View style={styles.navLinks}>
            <Pressable onPress={() => router.push('/privacy')}>
              <Text style={styles.navLink}>Privacy Policy</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/terms')}>
              <Text style={styles.navLink}>Terms of Service</Text>
            </Pressable>
            <Pressable onPress={goToSignIn}>
              {({ pressed, hovered }: any) => (
                <CornerCut
                  cut={9}
                  fill={pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
                  strokeColor="transparent"
                  style={styles.navSignInOuter}
                >
                  <View style={styles.navSignInContent}>
                    <Text style={styles.navSignInLabel}>Sign in</Text>
                  </View>
                </CornerCut>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Diamond size={9} color={color.ember} />
            <Text style={styles.heroBadgeLabel}>IRELAND'S APEX LEGENDS LEAGUE</Text>
          </View>
          <Text style={styles.heroHeadline}>Competitive Apex,{'\n'}organised properly.</Text>
          <Text style={styles.heroSubhead}>
            Beacon replaces the spreadsheets, Discord threads and screenshots with one place to register a
            team, submit a lineup, play your match, and see real, EA-verified standings — built for
            Ireland's Apex Legends community.
          </Text>
          <View style={styles.heroActions}>
            <Pressable onPress={goToSignIn}>
              {({ pressed, hovered }: any) => (
                <CornerCut
                  cut={10}
                  fill={pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
                  strokeColor="transparent"
                  style={styles.heroPrimaryOuter}
                >
                  <View style={styles.heroPrimaryContent}>
                    <Text style={styles.heroPrimaryLabel}>Sign in to Beacon</Text>
                  </View>
                </CornerCut>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.mission}>
          <Text style={styles.missionEyebrow}>WHY BEACON</Text>
          <Text style={styles.missionHeadline}>
            Every league we'd played in ran on trust — a captain's word, a screenshot, a spreadsheet
            someone forgot to update.
          </Text>
          <Text style={styles.missionBody}>
            Beacon's goal is simple: give Ireland's Apex Legends players a league platform where results
            are verified, not argued about, and where running a league doesn't mean chasing screenshots in
            a Discord server. Every stat shown with a verified badge was read from a real account. Every
            published result feeds standings automatically. Every admin action is auditable.
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.missionEyebrow}>WHAT YOU GET</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <HudPanel key={f.title} style={styles.featureCard} contentStyle={{ gap: 12 }}>
                <Ionicons name={f.icon} size={22} color={color.verified} />
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </HudPanel>
            ))}
          </View>
        </View>

        <View style={styles.ctaBand}>
          <Text style={styles.ctaHeadline}>Ready to play a season that keeps score properly?</Text>
          <Pressable onPress={goToSignIn}>
            {({ pressed, hovered }: any) => (
              <CornerCut
                cut={10}
                fill={pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
                strokeColor="transparent"
                style={styles.heroPrimaryOuter}
              >
                <View style={styles.heroPrimaryContent}>
                  <Text style={styles.heroPrimaryLabel}>Sign in to Beacon</Text>
                </View>
              </CornerCut>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={styles.navBrand}>
            <Logo size={18} />
            <Text style={styles.footerWordmark}>BEACON</Text>
          </View>
          <View style={styles.navLinks}>
            <Pressable onPress={() => router.push('/privacy')}>
              <Text style={styles.navLink}>Privacy Policy</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/terms')}>
              <Text style={styles.navLink}>Terms of Service</Text>
            </Pressable>
          </View>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} Beacon. Not affiliated with Electronic Arts or Respawn Entertainment.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
    flexWrap: 'wrap',
    gap: 14,
  },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 20, letterSpacing: 0.06 * 20, color: color.textPrimary },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 22, flexWrap: 'wrap' },
  navLink: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted },
  navSignInOuter: { height: 38 },
  navSignInContent: { flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  navSignInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.base },

  hero: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 56, gap: 20, maxWidth: 760, alignSelf: 'center', width: '100%', alignItems: 'flex-start' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroBadgeLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.14 * 11, color: color.textMuted },
  heroHeadline: { fontFamily: fontFamily.rajdhaniBold, fontSize: 52, lineHeight: 56, color: color.textPrimary },
  heroSubhead: { fontFamily: fontFamily.interRegular, fontSize: 16, lineHeight: 25, color: color.textMuted, maxWidth: 560 },
  heroActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  heroPrimaryOuter: { height: 52 },
  heroPrimaryContent: { flex: 1, paddingHorizontal: 26, alignItems: 'center', justifyContent: 'center' },
  heroPrimaryLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: color.base },

  mission: {
    paddingHorizontal: 24,
    paddingVertical: 56,
    gap: 16,
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  missionEyebrow: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.16 * 11, color: color.textMuted },
  missionHeadline: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 26, lineHeight: 32, color: color.textPrimary },
  missionBody: { fontFamily: fontFamily.interRegular, fontSize: 15, lineHeight: 23, color: color.textMuted },

  featuresSection: { paddingHorizontal: 24, paddingVertical: 40, gap: 22, maxWidth: 1040, alignSelf: 'center', width: '100%' },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  featureCard: { width: 300, flexGrow: 1 },
  featureTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 18, color: color.textPrimary },
  featureBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted },

  ctaBand: {
    paddingHorizontal: 24,
    paddingVertical: 56,
    gap: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    backgroundColor: color.panel,
  },
  ctaHeadline: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 24, lineHeight: 30, color: color.textPrimary, textAlign: 'center', maxWidth: 520 },

  footer: { paddingHorizontal: 24, paddingVertical: 32, gap: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: color.hairline },
  footerWordmark: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 15, color: color.textPrimary },
  footerCopy: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, textAlign: 'center' },
});
