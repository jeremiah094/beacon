import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Logo } from '../../components/Logo';
import { CornerCut } from '../../components/CornerCut';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily, space, titleColors } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useActiveTitle } from '../../lib/hooks/useActiveTitle';
import { TITLES, TitleMeta } from '../../lib/titles';

// Shown right after every login — the entry point into a title-scoped
// session (home dashboard, leagues, teams all read the choice made here
// via useActiveTitle). A returning player who's already verified for the
// title they tap skips straight past link-account into the app.
export default function ChooseGame() {
  const { setActiveTitle } = useActiveTitle();
  const [checkingSlug, setCheckingSlug] = useState<string | null>(null);

  async function selectTitle(title: TitleMeta) {
    if (checkingSlug) return;
    setCheckingSlug(title.slug);
    setActiveTitle(title.slug);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/(auth)/sign-up');
      return;
    }

    const { data: titleRow } = await supabase.from('titles').select('id').eq('slug', title.slug).single();
    const { data: account } = titleRow
      ? await supabase.from('game_accounts').select('verified_at').eq('profile_id', user.id).eq('title_id', titleRow.id).maybeSingle()
      : { data: null };

    setCheckingSlug(null);
    if (account?.verified_at) {
      router.replace('/(player)/stats');
    } else {
      router.push({ pathname: '/(auth)/link-account', params: { title: title.slug } });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wordmarkRow}>
          <Logo size={28} />
          <Text style={styles.wordmark}>BEACON</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.heading}>Pick your game</Text>
          <Text style={styles.bodyCopy}>Choose which league you're here for — you can switch anytime from your profile.</Text>
        </View>

        <View style={styles.grid}>
          {TITLES.map((title) => {
            const accent = titleColors(title.slug);
            const isChecking = checkingSlug === title.slug;
            const disabled = checkingSlug !== null;
            return (
              <Pressable key={title.slug} onPress={() => selectTitle(title)} disabled={disabled} style={styles.tileWrap}>
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
                        {isChecking && <Spinner size={12} strokeColor={accent.accent} />}
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
  scroll: { padding: 22, paddingTop: 12, gap: 30 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, letterSpacing: 0.06 * 28, color: color.textPrimary },
  heading: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, lineHeight: 32, color: color.textPrimary },
  bodyCopy: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 21, color: color.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tileWrap: { width: '47%' },
  tile: { minHeight: 140 },
  tileContent: { flex: 1, padding: space(4.5), justifyContent: 'space-between' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tileName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 20, color: color.textPrimary },
  tileTagline: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
});
