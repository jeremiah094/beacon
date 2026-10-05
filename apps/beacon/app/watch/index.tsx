import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Logo } from '../../components/Logo';
import { Spinner } from '../../components/Spinner';
import { CornerCut } from '../../components/CornerCut';
import { color, fontFamily, titleColors } from '../../theme/tokens';
import { PublicLeagueSummary, usePublicLeagues } from '../../lib/api/publicWatch';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

// Public, no-session league list — beaconproject.eu/watch. Every league
// here is already visible to a signed-out visitor at the data layer (see
// 20261005092248_public_watch_pages.sql); this is just giving that data
// somewhere to live outside the sign-in wall, both for spectators and for
// Google to actually have something to index and rank.
export default function PublicWatchIndex() {
  const { data: leagues, isLoading } = usePublicLeagues();
  useDocumentTitle('Watch — League Standings & Live Results — Beacon');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.push('/')} style={styles.navBrand}>
          <Logo size={22} />
          <Text style={styles.wordmark}>BEACON</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/sign-up')}>
          {({ pressed, hovered }: any) => (
            <View style={[styles.signInButton, (pressed || hovered) && { backgroundColor: color.fillHover }]}>
              <Text style={styles.signInLabel}>Sign in</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.title} role="heading" aria-level={1}>WATCH</Text>
        <Text style={styles.subtitle}>Live standings and results for every published Irish Apex Legends and Valorant league on Beacon.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size={20} />
          </View>
        ) : !leagues || leagues.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No leagues published yet — check back soon.</Text>
          </View>
        ) : (
          leagues.map((l) => <LeagueRow key={l.id} league={l} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LeagueRow({ league }: { league: PublicLeagueSummary }) {
  const accent = titleColors(league.titleSlug);
  return (
    <Pressable onPress={() => router.push(`/watch/${league.id}` as any)}>
      {({ pressed, hovered }: any) => (
        <CornerCut cut={16} fill={color.panel} strokeColor={pressed || hovered ? accent.accentBorder : color.hairline} style={{ width: '100%' }}>
          <View style={styles.row}>
            <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
              <View style={styles.titleChip}>
                <View style={[styles.titleDot, { backgroundColor: accent.accent }]} />
                <Text style={[styles.titleChipLabel, { color: accent.accent }]}>{league.titleName.toUpperCase()}</Text>
              </View>
              <Text style={styles.leagueName}>{league.name}</Text>
              <Text style={styles.leagueMeta}>
                {league.region}
                {league.seasonLabel ? ` · ${league.seasonLabel}` : ''} · {league.registeredTeams} team{league.registeredTeams === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </View>
        </CornerCut>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingBottom: 0 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 17, letterSpacing: 0.08 * 17, color: color.textPrimary },
  signInButton: { height: 36, paddingHorizontal: 16, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  signInLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  header: { padding: 22, paddingTop: 20, paddingBottom: 18, gap: 8, borderBottomWidth: 1, borderBottomColor: color.hairline },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 32, letterSpacing: 0.01 * 32, color: color.textPrimary },
  subtitle: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted, maxWidth: 480 },
  list: { padding: 22, paddingTop: 18, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 24 },
  emptyText: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  titleChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleDot: { width: 6, height: 6, borderRadius: 3 },
  titleChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.12 * 10 },
  leagueName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 20, letterSpacing: 0.01 * 20, color: color.textPrimary },
  leagueMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  arrow: { fontSize: 16, color: color.textMuted },
});
