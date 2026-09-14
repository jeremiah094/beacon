import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CornerCut } from '../../../components/CornerCut';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../theme/tokens';
import { formatDateRange } from '../../../lib/time';
import { LeagueSummary, useLeagues } from '../../../lib/api/leagues';

// Reference: Beacon 03 League Hub.dc.html
type Filter = 'all' | 'open' | 'full';

export default function LeagueHub() {
  const { data: leagues, isLoading } = useLeagues();
  const [filter, setFilter] = useState<Filter>('all');

  const all = leagues ?? [];
  const countOpen = all.filter((l) => l.isOpen).length;
  const countFull = all.length - countOpen;
  const visible = filter === 'all' ? all : all.filter((l) => (filter === 'open' ? l.isOpen : !l.isOpen));

  function goRegister(leagueId: string) {
    router.push({ pathname: '/(player)/teams', params: { joinLeagueId: leagueId } } as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ gap: 8 }}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.back}>←</Text>
            </Pressable>
            <Text style={styles.title}>BROWSE LEAGUES</Text>
          </View>
          <Text style={styles.subtitle}>Ireland · battle royale · 20 teams per lobby</Text>
        </View>

        <View style={styles.filterRow}>
          <FilterChip label={`All ${all.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label={`Open ${countOpen}`} active={filter === 'open'} onPress={() => setFilter('open')} />
          <FilterChip label={`Full ${countFull}`} active={filter === 'full'} onPress={() => setFilter('full')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size={20} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} onShowAll={() => setFilter('all')} />
        ) : (
          visible.map((lg) => <LeagueCard key={lg.id} league={lg} onJoin={() => goRegister(lg.id)} />)
        )}

        {visible.length > 0 && (
          <View style={styles.reminderBlock}>
            <Text style={styles.reminderCopy}>
              Season 4 registration opens 12 October. Turn on a reminder and we'll notify you the morning it does.
            </Text>
            <Pressable>
              <Text style={styles.reminderLink}>Remind me about Season 4</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={onPress}>
      <View
        style={[
          styles.chip,
          active ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput },
        ]}
      >
        <Text style={[styles.chipLabel, active && { color: color.base }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function LeagueCard({ league, onJoin }: { league: LeagueSummary; onJoin: () => void }) {
  const pct = Math.min(100, Math.round((league.registeredCount / league.teamsPerLobby) * 100));
  const ahead = Math.max(0, league.registeredCount - league.teamsPerLobby);
  const [waitlisted, setWaitlisted] = useState(false);

  return (
    <CornerCut
      cut={18}
      fill={color.panel}
      strokeColor={league.isOpen ? 'rgba(62,213,152,0.3)' : color.hairline}
      style={styles.cardOuter}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <View style={{ gap: 5, flex: 1, minWidth: 0 }}>
            <Text style={styles.leagueName}>{league.name}</Text>
            <Text style={styles.leagueDates}>
              {league.seasonLabel ? `${league.seasonLabel} · ` : ''}
              {formatDateRange(league.seasonStart, league.seasonEnd)}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              league.isOpen
                ? { backgroundColor: color.verifiedTint, borderColor: color.verifiedTintBorder }
                : { borderColor: color.neutralBorder },
            ]}
          >
            <Text style={[styles.statusChipLabel, { color: league.isOpen ? color.verified : color.textMuted }]}>
              {league.isOpen ? 'OPEN' : 'FULL'}
            </Text>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={styles.metaLine}>{league.format}</Text>
          {league.entryRules ? <Text style={[styles.metaLine, tabularNums]}>{league.entryRules}</Text> : null}
        </View>

        <View style={{ gap: 7 }}>
          <View style={styles.capacityRow}>
            <Text style={styles.capacityLabel}>TEAMS REGISTERED</Text>
            <Text style={[styles.capacityValue, { color: league.isOpen ? color.textPrimary : color.textMuted }, tabularNums]}>
              {league.registeredCount} / {league.teamsPerLobby}
            </Text>
          </View>
          <View style={styles.capacityTrack}>
            <View
              style={[
                styles.capacityFill,
                { width: `${pct}%`, backgroundColor: league.isOpen ? color.verified : 'rgba(242,241,236,0.3)' },
              ]}
            />
          </View>
        </View>

        {league.isOpen ? (
          <Pressable onPress={onJoin}>
            {({ hovered }: any) => (
              <CornerCut cut={9} fill={hovered ? color.fillHover : color.textPrimary} strokeColor="transparent" style={styles.joinOuter}>
                <View style={styles.joinContent}>
                  <Text style={styles.joinLabel}>Join {league.name.replace(/^Beacon /, '')}</Text>
                </View>
              </CornerCut>
            )}
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>
                {ahead > 0
                  ? `All ${league.teamsPerLobby} slots are taken and ${ahead} teams are waiting. Waitlisted teams are offered slots in order if one frees up.`
                  : `All ${league.teamsPerLobby} slots are taken. Join the waitlist and you'll be offered the next slot that frees up.`}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setWaitlisted(true);
                onJoin();
              }}
            >
              {({ pressed, hovered }: any) => (
                <View style={[styles.waitlistButton, (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted }]}>
                  <Text style={styles.waitlistLabel}>{waitlisted ? 'On the waitlist' : 'Join waitlist'}</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </CornerCut>
  );
}

function EmptyState({ filter, onShowAll }: { filter: Filter; onShowAll: () => void }) {
  const title = filter === 'open' ? 'No leagues open right now' : 'Nothing full right now';
  const body =
    filter === 'open'
      ? 'Every division has filled. Season 4 registration opens 12 October — or join a waitlist and take the next slot that frees up.'
      : 'Every division still has room. Nothing is at capacity.';
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyDots}>
        <View style={[styles.emptyDot, { borderColor: 'rgba(242,241,236,0.3)' }]} />
        <View style={[styles.emptyDot, { borderColor: 'rgba(242,241,236,0.18)' }]} />
        <View style={[styles.emptyDot, { borderColor: 'rgba(242,241,236,0.1)' }]} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <Pressable onPress={onShowAll}>
        {({ pressed, hovered }: any) => (
          <View style={[styles.showAllButton, (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted }]}>
            <Text style={styles.showAllLabel}>Show all leagues</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  header: { padding: 22, paddingBottom: 18, gap: 18, borderBottomWidth: 1, borderBottomColor: color.hairline },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 18, color: color.textMuted },
  title: { fontFamily: fontFamily.rajdhaniBold, fontSize: 30, letterSpacing: 0.01 * 30, color: color.textPrimary },
  subtitle: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { height: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  list: { padding: 22, gap: 14 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  cardOuter: { width: '100%' },
  cardContent: { padding: 18, gap: 14 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  leagueName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 20, letterSpacing: 0.01 * 20, color: color.textPrimary },
  leagueDates: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1 },
  statusChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9 },
  metaLine: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15, color: color.textMuted },
  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  capacityLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.12 * 10, color: color.textMuted },
  capacityValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 14 },
  capacityTrack: { height: 4, backgroundColor: color.hairline, flexDirection: 'row' },
  capacityFill: { height: 4 },
  joinOuter: { height: 44, width: '100%' },
  joinContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  joinLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.base },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  waitlistButton: { height: 44, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  waitlistLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  reminderBlock: { gap: 12, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 18, marginTop: 4 },
  reminderCopy: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 18, color: color.textMuted },
  reminderLink: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.verified, alignSelf: 'flex-start' },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 22, paddingVertical: 28, gap: 16, alignItems: 'flex-start' },
  emptyDots: { flexDirection: 'row', gap: 5 },
  emptyDot: { width: 11, height: 11, borderWidth: 1 },
  emptyTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 24, lineHeight: 26, color: color.textPrimary },
  emptyBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19.5, color: color.textMuted },
  showAllButton: { height: 44, paddingHorizontal: 18, borderWidth: 1, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  showAllLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
});
