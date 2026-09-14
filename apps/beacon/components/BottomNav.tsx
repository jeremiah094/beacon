import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { color, fontFamily } from '../theme/tokens';

type TabKey = 'stats' | 'leagues' | 'teams' | 'games' | 'profile';

const TABS: { key: TabKey; label: string; href: string }[] = [
  { key: 'stats', label: 'Home', href: '/(player)/stats' },
  { key: 'leagues', label: 'Leagues', href: '/(player)/leagues' },
  { key: 'teams', label: 'Teams', href: '/(player)/teams' },
  { key: 'games', label: 'Games', href: '/(player)/games' },
  { key: 'profile', label: 'Profile', href: '/(player)/profile' },
];

/** Not one of BUILD.md's 16 reference screens — the source mockups are
 * each a standalone push destination with their own back arrow. This adds
 * the persistent tab bar a real app needs to move between them, without
 * restructuring routing into nested per-tab stacks (every existing
 * router.push('/(player)/...') call keeps working unchanged). Shown on
 * the five hub screens only; a pushed detail screen (lineup, lobby,
 * standings) keeps its own back arrow instead. */
export function BottomNav({ active }: { active: TabKey }) {
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (pathname !== `/${tab.key}`) router.push(tab.href as any);
            }}
          >
            {({ hovered }: any) => (
              <View style={styles.tabInner}>
                <View
                  style={[
                    styles.dot,
                    { borderColor: isActive ? color.textPrimary : color.textMuted, backgroundColor: isActive ? color.textPrimary : 'transparent' },
                  ]}
                />
                <Text style={[styles.label, { color: isActive ? color.textPrimary : color.textMuted }, hovered && !isActive && { color: color.textPrimary }]}>
                  {tab.label.toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    backgroundColor: color.panel,
  },
  tab: { flex: 1 },
  tabInner: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.1 * 10 },
});
