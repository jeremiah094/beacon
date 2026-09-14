import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Diamond } from '../Diamond';
import { color, fontFamily } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/hooks/useSession';
import { useAdminNavCounts, useAdminProfile } from '../../lib/api/admin';

export type AdminNavKey = 'leagues' | 'approvals' | 'schedule' | 'live' | 'results';

type Breadcrumb = { label: string; href?: string };

type Props = {
  active: AdminNavKey;
  /** When set, "Team approvals"/"Schedule"/"Live matches"/"Results" deep-link
   * into this league instead of the leagues list (live/results are surfaced
   * from the schedule table itself — there's no separate list screen for
   * them, matching the reference screens' own scope). */
  activeLeagueId?: string;
  breadcrumbs: Breadcrumb[];
  title: string;
  titleMeta?: string;
  actions?: ReactNode;
  belowTopBar?: ReactNode;
  rail?: ReactNode;
  railWidth?: number;
  children: ReactNode;
};

const NAV_ITEMS: { key: AdminNavKey; label: string }[] = [
  { key: 'leagues', label: 'Leagues' },
  { key: 'approvals', label: 'Team approvals' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'live', label: 'Live matches' },
  { key: 'results', label: 'Results' },
];

export function AdminShell({
  active,
  activeLeagueId,
  breadcrumbs,
  title,
  titleMeta,
  actions,
  belowTopBar,
  rail,
  railWidth = 372,
  children,
}: Props) {
  const { userId } = useSession();
  const { data: counts } = useAdminNavCounts();
  const { data: profile } = useAdminProfile(userId);

  function hrefFor(key: AdminNavKey): string {
    if (key === 'leagues') return '/(admin)/leagues';
    if (!activeLeagueId) return '/(admin)/leagues';
    if (key === 'approvals') return `/(admin)/leagues/${activeLeagueId}/teams`;
    return `/(admin)/leagues/${activeLeagueId}/schedule`; // schedule/live/results all surface from here
  }

  function countFor(key: AdminNavKey): string {
    if (!counts) return '';
    if (key === 'leagues') return String(counts.leagues);
    if (key === 'approvals') return String(counts.pendingApprovals);
    if (key === 'schedule') return String(counts.scheduled);
    if (key === 'live') return String(counts.live);
    return String(counts.results);
  }

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <View style={styles.wordmarkRow}>
            <Diamond size={12} color={color.ember} />
            <Text style={styles.wordmark}>BEACON</Text>
          </View>
          <Text style={styles.consoleLabel}>ADMIN CONSOLE</Text>
        </View>

        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Pressable key={item.key} onPress={() => router.push(hrefFor(item.key) as any)}>
                {({ hovered }: any) => (
                  <View
                    style={[
                      styles.navRow,
                      { backgroundColor: isActive ? color.panel : hovered ? 'rgba(242,241,236,0.04)' : 'transparent' },
                      { borderLeftColor: isActive ? color.textPrimary : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.navLabel, { color: isActive ? color.textPrimary : color.textMuted }]}>{item.label}</Text>
                    <Text style={styles.navCount}>{countFor(item.key)}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <View style={[styles.navRow, { opacity: 0.4 }]}>
            <Text style={[styles.navLabel, { color: color.textMuted }]}>Settings</Text>
          </View>
        </View>

        <View style={styles.sidebarFooter}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarLabel}>{profile?.initials ?? '··'}</Text>
          </View>
          <View style={{ gap: 3, minWidth: 0, flex: 1 }}>
            <Text style={styles.footerName}>{profile?.name ?? 'Admin'}</Text>
            <Text style={styles.footerRole}>League organiser</Text>
          </View>
          <Pressable onPress={() => supabase.auth.signOut().then(() => router.replace('/(auth)/sign-up'))}>
            {({ hovered }: any) => <Text style={[styles.signOutLabel, hovered && { color: color.textPrimary }]}>Sign out</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.main}>
        <View style={styles.topBar}>
          <View style={{ gap: 9, flex: 1, minWidth: 0 }}>
            <View style={styles.breadcrumbRow}>
              {breadcrumbs.map((b, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  {i > 0 && <Text style={styles.breadcrumbSep}>/</Text>}
                  {b.href ? (
                    <Pressable onPress={() => router.push(b.href as any)}>
                      {({ hovered }: any) => (
                        <Text style={[styles.breadcrumbLink, hovered && { color: color.textPrimary }]}>{b.label}</Text>
                      )}
                    </Pressable>
                  ) : (
                    <Text style={styles.breadcrumbCurrent}>{b.label}</Text>
                  )}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
              <Text style={styles.title}>{title}</Text>
              {titleMeta ? <Text style={styles.titleMeta}>{titleMeta}</Text> : null}
            </View>
          </View>
          {actions ? <View style={styles.actionsRow}>{actions}</View> : null}
        </View>

        {belowTopBar}

        <View style={styles.body}>
          <ScrollView contentContainerStyle={[styles.mainScroll, !!rail && { borderRightWidth: 1, borderRightColor: color.hairline }]}>
            {children}
          </ScrollView>
          {rail ? (
            <ScrollView style={{ width: railWidth, flexGrow: 0 }} contentContainerStyle={styles.railScroll}>
              {rail}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: color.base, minHeight: '100%' },
  sidebar: { width: 236, borderRightWidth: 1, borderRightColor: color.hairline, backgroundColor: '#0E0F12' },
  sidebarHeader: { padding: 22, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: color.hairline, gap: 8 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, letterSpacing: 0.06 * 22, color: color.textPrimary },
  consoleLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.18 * 9, color: color.textMuted },
  navList: { padding: 12, gap: 2 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
  },
  navLabel: { fontFamily: fontFamily.interMedium, fontSize: 13 },
  navCount: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted },
  sidebarFooter: {
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 'auto',
  },
  avatarBox: { width: 32, height: 32, borderWidth: 1, borderColor: color.neutralBorder, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: fontFamily.rajdhaniBold, fontSize: 11, color: color.textMuted },
  footerName: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  footerRole: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted },
  signOutLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted },
  main: { flex: 1, minWidth: 0 },
  topBar: {
    padding: 20,
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  breadcrumbSep: { color: 'rgba(242,241,236,0.28)', fontSize: 11 },
  breadcrumbLink: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  breadcrumbCurrent: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textPrimary },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 34, letterSpacing: 0.01 * 34, color: color.textPrimary },
  titleMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, flexDirection: 'row', minWidth: 0 },
  mainScroll: { flexGrow: 1, padding: 28, gap: 24, alignItems: 'stretch' },
  railScroll: { padding: 24, gap: 16 },
});
