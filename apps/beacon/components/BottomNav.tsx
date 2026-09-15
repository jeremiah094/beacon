import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { color, fontFamily } from '../theme/tokens';

type TabKey = 'stats' | 'leagues' | 'teams' | 'games' | 'profile';

const TABS: {
  key: TabKey;
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'stats', label: 'Home', href: '/(player)/stats', icon: 'home-outline', iconActive: 'home' },
  { key: 'leagues', label: 'Leagues', href: '/(player)/leagues', icon: 'trophy-outline', iconActive: 'trophy' },
  { key: 'teams', label: 'Teams', href: '/(player)/teams', icon: 'people-outline', iconActive: 'people' },
  { key: 'games', label: 'Games', href: '/(player)/games', icon: 'game-controller-outline', iconActive: 'game-controller' },
  { key: 'profile', label: 'Profile', href: '/(player)/profile', icon: 'person-outline', iconActive: 'person' },
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
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={20}
                  color={isActive ? color.textPrimary : hovered ? color.textPrimary : color.textMuted}
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
  tabInner: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.1 * 10 },
});
