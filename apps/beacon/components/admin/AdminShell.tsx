import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../Logo';
import { color, fontFamily } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/hooks/useSession';
import { useAdminNavCounts, useAdminProfile } from '../../lib/api/admin';

export type AdminNavKey = 'leagues' | 'approvals' | 'schedule' | 'live' | 'results' | 'settings';

const LEAGUE_SCOPED_KEYS: AdminNavKey[] = ['approvals', 'schedule', 'live', 'results'];

type Breadcrumb = { label: string; href?: string };

type Props = {
  active: AdminNavKey;
  /** When set, "Team approvals"/"Schedule"/"Live matches"/"Results" deep-link
   * into this league instead of the leagues list. Live matches still
   * surfaces from the schedule table itself (no dedicated list screen);
   * Results has its own list screen. */
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

const NAV_ITEMS: { key: AdminNavKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'leagues', label: 'Leagues', icon: 'trophy-outline' },
  { key: 'approvals', label: 'Team approvals', icon: 'checkmark-circle-outline' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
  { key: 'live', label: 'Live matches', icon: 'radio-outline' },
  { key: 'results', label: 'Results', icon: 'flag-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
];

// Below this viewport width the fixed 236px sidebar + 372px rail alongside
// a scrollable middle column stop fitting a phone-sized browser (the admin
// console is a web-only surface — see BUILD.md task 9 — but still gets
// opened from a phone browser in practice), so the shell switches to a
// collapsible drawer and a stacked rail instead of the 3-column layout.
const MOBILE_BREAKPOINT = 860;

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
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [navOpen, setNavOpen] = useState(false);

  function hrefFor(key: AdminNavKey): string {
    if (key === 'leagues') return '/(admin)/leagues';
    if (key === 'settings') return '/(admin)/settings';
    if (!activeLeagueId) return '/(admin)/leagues';
    if (key === 'approvals') return `/(admin)/leagues/${activeLeagueId}/teams`;
    if (key === 'results') return `/(admin)/leagues/${activeLeagueId}/results`;
    return `/(admin)/leagues/${activeLeagueId}/schedule`; // schedule/live surface from here
  }

  function countFor(key: AdminNavKey): string {
    if (!counts) return '';
    if (key === 'leagues') return String(counts.leagues);
    if (key === 'approvals') return String(counts.pendingApprovals);
    if (key === 'schedule') return String(counts.scheduled);
    if (key === 'live') return String(counts.live);
    if (key === 'results') return String(counts.results);
    return '';
  }

  function goTo(key: AdminNavKey) {
    setNavOpen(false);
    router.push(hrefFor(key) as any);
  }

  const sidebarContent = (
    <>
      <View style={styles.sidebarHeader}>
        <View style={styles.wordmarkRow}>
          <Logo size={24} />
          <Text style={styles.wordmark}>BEACON</Text>
        </View>
        <Text style={styles.consoleLabel}>ADMIN CONSOLE</Text>
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          const isDisabled = LEAGUE_SCOPED_KEYS.includes(item.key) && !activeLeagueId;
          if (isDisabled) {
            return (
              <View key={item.key} style={[styles.navRow, { opacity: 0.4 }]}>
                <View style={styles.navLabelRow}>
                  <Ionicons name={item.icon} size={15} color={color.textMuted} />
                  <Text style={[styles.navLabel, { color: color.textMuted }]}>{item.label}</Text>
                </View>
              </View>
            );
          }
          return (
            <Pressable key={item.key} onPress={() => goTo(item.key)}>
              {({ hovered }: any) => (
                <View
                  style={[
                    styles.navRow,
                    { backgroundColor: isActive ? color.panel : hovered ? 'rgba(242,241,236,0.04)' : 'transparent' },
                    { borderLeftColor: isActive ? color.textPrimary : 'transparent' },
                  ]}
                >
                  <View style={styles.navLabelRow}>
                    <Ionicons name={item.icon} size={15} color={isActive ? color.textPrimary : color.textMuted} />
                    <Text style={[styles.navLabel, { color: isActive ? color.textPrimary : color.textMuted }]}>{item.label}</Text>
                  </View>
                  <Text style={styles.navCount}>{countFor(item.key)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
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
          {({ hovered }: any) => (
            <View style={styles.signOutRow}>
              <Ionicons name="log-out-outline" size={14} color={hovered ? color.textPrimary : color.textMuted} />
              <Text style={[styles.signOutLabel, hovered && { color: color.textPrimary }]}>Sign out</Text>
            </View>
          )}
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      {!isMobile && <View style={styles.sidebar}>{sidebarContent}</View>}

      {isMobile && navOpen && (
        <>
          <Pressable style={styles.scrim} onPress={() => setNavOpen(false)} />
          <View style={styles.drawer}>{sidebarContent}</View>
        </>
      )}

      <View style={styles.main}>
        {isMobile && (
          <View style={styles.mobileHeader}>
            <Pressable onPress={() => setNavOpen(true)} hitSlop={10}>
              <Ionicons name="menu-outline" size={22} color={color.textPrimary} />
            </Pressable>
            <View style={styles.wordmarkRow}>
              <Logo size={18} />
              <Text style={styles.wordmarkSmall}>BEACON</Text>
            </View>
            <View style={[styles.avatarBox, { width: 28, height: 28 }]}>
              <Text style={styles.avatarLabel}>{profile?.initials ?? '··'}</Text>
            </View>
          </View>
        )}

        <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
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
              <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
              {titleMeta ? <Text style={styles.titleMeta}>{titleMeta}</Text> : null}
            </View>
          </View>
          {actions ? <View style={styles.actionsRow}>{actions}</View> : null}
        </View>

        {belowTopBar}

        <View style={[styles.body, isMobile && styles.bodyMobile]}>
          <ScrollView
            contentContainerStyle={[
              styles.mainScroll,
              isMobile && styles.mainScrollMobile,
              !!rail && !isMobile && { borderRightWidth: 1, borderRightColor: color.hairline },
              !!rail && isMobile && { borderBottomWidth: 1, borderBottomColor: color.hairline },
            ]}
          >
            {children}
          </ScrollView>
          {rail ? (
            <ScrollView
              style={isMobile ? { width: '100%', flexGrow: 0 } : { width: railWidth, flexGrow: 0 }}
              contentContainerStyle={styles.railScroll}
            >
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
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 260,
    maxWidth: '82%',
    borderRightWidth: 1,
    borderRightColor: color.hairline,
    backgroundColor: '#0E0F12',
    zIndex: 11,
  },
  sidebarHeader: { padding: 22, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: color.hairline, gap: 8 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, letterSpacing: 0.06 * 22, color: color.textPrimary },
  wordmarkSmall: { fontFamily: fontFamily.rajdhaniBold, fontSize: 17, letterSpacing: 0.06 * 17, color: color.textPrimary },
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
  navLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
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
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signOutLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted },
  main: { flex: 1, minWidth: 0 },
  mobileHeader: {
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E0F12',
  },
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
  topBarMobile: { padding: 16, gap: 14 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  breadcrumbSep: { color: 'rgba(242,241,236,0.28)', fontSize: 11 },
  breadcrumbLink: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  breadcrumbCurrent: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textPrimary },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 34, letterSpacing: 0.01 * 34, color: color.textPrimary },
  titleMobile: { fontSize: 24 },
  titleMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  body: { flex: 1, flexDirection: 'row', minWidth: 0 },
  bodyMobile: { flexDirection: 'column' },
  mainScroll: { flexGrow: 1, padding: 28, gap: 24, alignItems: 'stretch' },
  mainScrollMobile: { padding: 16, gap: 18 },
  railScroll: { padding: 24, gap: 16 },
});
