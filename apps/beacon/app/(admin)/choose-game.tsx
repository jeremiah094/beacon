import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Logo } from '../../components/Logo';
import { CornerCut } from '../../components/CornerCut';
import { color, fontFamily, space, titleColors } from '../../theme/tokens';
import { useActiveAdminTitle } from '../../lib/hooks/useActiveAdminTitle';
import { TITLES, TitleMeta } from '../../lib/titles';

// Admin-side equivalent of (auth)/choose-game.tsx — which game's console
// (leagues, schedule, results) the operator is managing right now. Every
// title is selectable; one without admin tooling yet (adminToolsAvailable)
// just lands on a "coming soon" state inside the leagues screen rather
// than being blocked from picking it here.
export default function AdminChooseGame() {
  const { setActiveAdminTitle } = useActiveAdminTitle();

  function selectTitle(title: TitleMeta) {
    setActiveAdminTitle(title.slug);
    router.replace('/(admin)/leagues');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wordmarkRow}>
          <Logo size={26} />
          <Text style={styles.wordmark}>BEACON</Text>
          <Text style={styles.consoleLabel}>ADMIN CONSOLE</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.heading}>Which game are you managing?</Text>
          <Text style={styles.bodyCopy}>Pick a title to open its leagues, schedule and results. Switch anytime from the sidebar.</Text>
        </View>

        <View style={styles.grid}>
          {TITLES.map((title) => {
            const accent = titleColors(title.slug);
            return (
              <Pressable key={title.slug} onPress={() => selectTitle(title)} style={styles.tileWrap}>
                {({ pressed, hovered }: any) => (
                  <CornerCut
                    cut={18}
                    fill={pressed || hovered ? accent.accentTint : color.panel}
                    strokeColor={accent.accentBorder}
                    style={styles.tile}
                  >
                    <View style={styles.tileContent}>
                      <View style={styles.tileTop}>
                        <View style={[styles.dot, { backgroundColor: accent.accent }]} />
                        {!title.adminToolsAvailable && (
                          <View style={styles.comingSoonChip}>
                            <Text style={styles.comingSoonLabel}>COMING SOON</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ gap: 3 }}>
                        <Text style={styles.tileName}>{title.name}</Text>
                        <Text style={styles.tileTagline}>{title.tagline}</Text>
                      </View>
                    </View>
                  </CornerCut>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  scroll: { padding: 32, paddingTop: 40, gap: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 24, letterSpacing: 0.06 * 24, color: color.textPrimary },
  consoleLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, color: color.textMuted, marginLeft: 4 },
  heading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, lineHeight: 32, color: color.textPrimary },
  bodyCopy: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 21, color: color.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tileWrap: { width: '47%', minWidth: 220 },
  tile: { minHeight: 140 },
  tileContent: { flex: 1, padding: space(4.5), justifyContent: 'space-between' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  comingSoonChip: { borderWidth: 1, borderColor: color.neutralBorder, paddingVertical: 3, paddingHorizontal: 7 },
  comingSoonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.1 * 9, color: color.textMuted },
  tileName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 20, color: color.textPrimary },
  tileTagline: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
});
