import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminShell } from '../../../components/admin/AdminShell';
import { AdminButton } from '../../../components/admin/AdminButton';
import { AdminChip } from '../../../components/admin/AdminChip';
import { AdminDateField } from '../../../components/admin/AdminDateField';
import { CornerCut } from '../../../components/CornerCut';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../theme/tokens';
import { useSession } from '../../../lib/hooks/useSession';
import { useAdminLeague, useSaveLeague } from '../../../lib/api/adminLeagues';

// Reference: Beacon 11 Create League.dc.html. Also serves as the edit
// screen (?leagueId=X) — BUILD.md's 16 screens don't include a separate
// edit flow, and this form covers exactly the same fields either way.
// The source offers a scoring-model *picker* (ALGS vs. a flat curve);
// BUILD.md §2 commits to one fixed ALGS formula (placement_points() in the
// database), so this shows that one model as information, not a choice —
// there's nothing for a second option to actually change server-side.
const REGIONS = ['Ireland-wide', 'Leinster', 'Munster', 'Connacht / Ulster'];

export default function CreateOrEditLeague() {
  const { leagueId } = useLocalSearchParams<{ leagueId?: string }>();
  const { userId } = useSession();
  const { data: existing, isLoading } = useAdminLeague(leagueId);
  const saveLeague = useSaveLeague(leagueId, userId);

  const [name, setName] = useState('');
  const [seasonLabel, setSeasonLabel] = useState('Season 3');
  const [region, setRegion] = useState(REGIONS[0]);
  const [teams, setTeams] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryRules, setEntryRules] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setSeasonLabel(existing.season_label ?? '');
      setRegion(existing.region);
      setTeams(existing.teams_per_lobby);
      setStartDate(existing.season_start ?? '');
      setEndDate(existing.season_end ?? '');
      setEntryRules(existing.entry_rules ?? '');
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (leagueId && (isLoading || !loaded)) {
    return (
      <AdminShell active="leagues" breadcrumbs={[{ label: 'Leagues', href: '/(admin)/leagues' }, { label: 'Edit league' }]} title="EDIT LEAGUE">
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      </AdminShell>
    );
  }

  const published = existing?.status === 'published';

  const missing: string[] = [];
  if (!name.trim()) missing.push('a league name');
  if (!startDate.trim()) missing.push('a season start date');
  if (!endDate.trim()) missing.push('a season end date');
  const ready = missing.length === 0;
  let blockedReason = '';
  if (missing.length === 1) blockedReason = `Publish needs ${missing[0]}.`;
  else if (missing.length > 1) blockedReason = `Publish needs ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}.`;

  async function handleSave(publish: boolean) {
    const id = await saveLeague.mutateAsync({
      form: { name, seasonLabel, region, teamsPerLobby: teams, seasonStart: parseDate(startDate), seasonEnd: parseDate(endDate), entryRules },
      publish,
    });
    if (!leagueId) router.replace({ pathname: '/(admin)/leagues/create', params: { leagueId: id } } as any);
  }

  return (
    <AdminShell
      active="leagues"
      activeLeagueId={leagueId}
      breadcrumbs={[{ label: 'Leagues', href: '/(admin)/leagues' }, { label: leagueId ? 'Edit league' : 'New league' }]}
      title={leagueId ? 'EDIT LEAGUE' : 'CREATE LEAGUE'}
      actions={
        <>
          <AdminChip label={published ? 'LIVE' : 'DRAFT'} tone={published ? 'verified' : 'neutral'} dotShape="circle" />
          <AdminButton label="Save draft" variant="secondary" onPress={() => handleSave(false)} disabled={!name.trim() || saveLeague.isPending} />
          <AdminButton
            label={published ? 'Published' : 'Publish league'}
            onPress={() => handleSave(true)}
            disabled={published || !ready || saveLeague.isPending}
          />
        </>
      }
      rail={
        <>
          <Text style={styles.railTitle}>{published ? 'Live in Browse leagues' : 'Player preview'}</Text>
          <CornerCut cut={20} fill={color.panel} strokeColor={published ? color.verifiedTintBorder : color.hairline}>
            <View style={styles.previewContent}>
              <AdminChip
                label={published ? 'OPEN FOR REGISTRATION' : 'NOT VISIBLE TO PLAYERS'}
                tone={published ? 'verified' : 'neutral'}
                dotShape="circle"
              />
              <Text style={styles.previewName}>{name.trim() || 'Untitled league'}</Text>
              <View style={styles.previewSummary}>
                {[
                  ['Region', region],
                  ['Format', 'Battle royale · trios'],
                  ['Teams per lobby', String(teams)],
                  ['Season', seasonLabel || '—'],
                  ['Dates', startDate && endDate ? `${startDate} – ${endDate}` : 'Not set'],
                  ['Scoring', 'ALGS placement + kills'],
                ].map(([k, v]) => (
                  <View key={k} style={styles.summaryRow}>
                    <Text style={styles.summaryK}>{k}</Text>
                    <Text style={styles.summaryV}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </CornerCut>

          {!published && !ready && (
            <View style={styles.noteRow}>
              <View style={styles.noteBar} />
              <Text style={styles.noteText}>{blockedReason}</Text>
            </View>
          )}

          {published ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>WHAT JUST HAPPENED</Text>
              <Text style={styles.infoBody}>
                The league is listed in Browse leagues and teams can register up to capacity. Dates and capacity stay
                editable until the first game is scheduled.
              </Text>
              <Pressable onPress={() => leagueId && router.push(`/(admin)/leagues/${leagueId}/teams` as any)}>
                <Text style={styles.infoLink}>Go to team approvals →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>DRAFT BEHAVIOUR</Text>
              <Text style={styles.infoBody}>
                A draft is invisible to players. Nothing is announced and no registration opens until you publish.
              </Text>
            </View>
          )}
        </>
      }
    >
      <View style={styles.fieldRow2}>
        <Field label="League name">
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Beacon Division Two" placeholderTextColor={color.fillPlaceholder} style={styles.input} />
        </Field>
        <Field label="Season label">
          <TextInput value={seasonLabel} onChangeText={setSeasonLabel} placeholder="Season 3" placeholderTextColor={color.fillPlaceholder} style={styles.input} />
        </Field>
      </View>

      <Field label="Region">
        <View style={styles.chipRow}>
          {REGIONS.map((r) => (
            <ChipOption key={r} label={r} active={region === r} onPress={() => setRegion(r)} />
          ))}
        </View>
        <Text style={styles.helper}>Ireland-wide by default. Narrowing the region limits which teams can register.</Text>
      </Field>

      <Field label="Format">
        <View style={styles.formatBox}>
          <View style={{ gap: 6, flex: 1 }}>
            <Text style={styles.formatTitle}>Battle royale · trios</Text>
            <Text style={styles.formatDesc}>Fixed. Apex league play is trios sharing one lobby — there is no head-to-head fixture.</Text>
          </View>
          <View style={styles.formatDivider} />
          <View style={{ gap: 11, flex: 1.2 }}>
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>TEAMS PER LOBBY</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Stepper disabled={teams <= 8} onPress={() => setTeams((t) => Math.max(8, t - 1))} label="−" />
                <Text style={[styles.stepperValue, tabularNums]}>{teams}</Text>
                <Stepper disabled={teams >= 20} onPress={() => setTeams((t) => Math.min(20, t + 1))} label="+" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {Array.from({ length: 13 }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 4, backgroundColor: i < teams - 7 ? color.textPrimary : 'rgba(242,241,236,0.16)' }} />
              ))}
            </View>
            <Text style={styles.helper}>
              {teams >= 20 ? '20 is the maximum a single Apex custom lobby holds.' : `${teams} of a possible 20 slots. Unfilled slots are simply empty on match night.`}
            </Text>
          </View>
        </View>
      </Field>

      <Field label="Season dates">
        <View style={styles.dateRow}>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.dateLabel}>STARTS</Text>
            <AdminDateField value={startDate} onChange={setStartDate} />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.dateLabel}>ENDS</Text>
            <AdminDateField value={endDate} onChange={setEndDate} />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.dateLabel}>DURATION</Text>
            <View style={styles.durationBox}>
              <Text style={styles.durationText}>{durationLabel(startDate, endDate)}</Text>
            </View>
          </View>
        </View>
      </Field>

      <Field label="Scoring model">
        <CornerCut cut={16} fill={color.panel} strokeColor="rgba(62,213,152,0.4)">
          <View style={styles.scoringContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ gap: 5 }}>
                <Text style={styles.scoringTitle}>ALGS placement + kills</Text>
                <Text style={styles.scoringDesc}>Standard competitive Apex scoring. Matches what teams already know from pro play.</Text>
              </View>
            </View>
            <View style={styles.scoringRules}>
              {[
                ['1st place', '12 pts'],
                ['2nd / 3rd', '9 / 7 pts'],
                ['4th–5th · 6th–7th', '5 / 4 pts'],
                ['8th–10th · 11th–15th', '2 / 1 pts'],
                ['Per kill', '1 pt'],
              ].map(([k, v]) => (
                <View key={k} style={styles.summaryRow}>
                  <Text style={styles.summaryK}>{k}</Text>
                  <Text style={styles.summaryV}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        </CornerCut>
        <Text style={styles.helper}>
          Kill and placement data is read from EA after each lobby closes. The scoring model is fixed for every league.
        </Text>
      </Field>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 9 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.optionChip, active ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
        <Text style={[styles.optionChipLabel, active && { color: color.base }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function Stepper({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <View style={[styles.stepperButton, { borderColor: disabled ? color.fillMutedBorder : color.hairlineStrong }]}>
        <Text style={[styles.stepperButtonLabel, { color: disabled ? 'rgba(242,241,236,0.35)' : color.textPrimary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function parseDate(text: string): string {
  const d = new Date(text);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function durationLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'Set both dates';
  const weeks = Math.max(1, Math.round((e.getTime() - s.getTime()) / (7 * 24 * 3600 * 1000)));
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  fieldRow2: { flexDirection: 'row', gap: 20 },
  fieldLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  input: { height: 48, backgroundColor: color.panel, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontSize: 15, paddingHorizontal: 14, flex: 1, fontFamily: fontFamily.interRegular },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  optionChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  helper: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15.5, color: color.textMuted },
  formatBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 20, flexDirection: 'row', gap: 20 },
  formatTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 18, letterSpacing: 0.02 * 18, color: color.textPrimary },
  formatDesc: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15.5, color: color.textMuted },
  formatDivider: { width: 1, backgroundColor: color.hairline },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepperLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.12 * 10, color: color.textMuted },
  stepperButton: { width: 32, height: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 16 },
  stepperValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 24, minWidth: 32, textAlign: 'center', color: color.textPrimary },
  dateRow: { flexDirection: 'row', gap: 14 },
  dateLabel: { fontFamily: fontFamily.interRegular, fontSize: 10, letterSpacing: 0.1 * 10, color: color.textMuted },
  durationBox: { height: 46, borderWidth: 1, borderColor: color.fillMutedBorder, backgroundColor: 'rgba(242,241,236,0.03)', justifyContent: 'center', paddingHorizontal: 12 },
  durationText: { fontFamily: fontFamily.interMedium, fontSize: 14, color: color.textMuted, ...tabularNums },
  scoringContent: { padding: 18, gap: 12 },
  scoringTitle: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, letterSpacing: 0.02 * 17, color: color.textPrimary },
  scoringDesc: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15.5, color: color.textMuted },
  scoringRules: { gap: 8, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  summaryK: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  summaryV: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textPrimary, ...tabularNums },
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  previewContent: { padding: 20, gap: 14 },
  previewName: { fontFamily: fontFamily.rajdhaniBold, fontSize: 24, color: color.textPrimary },
  previewSummary: { gap: 10, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 14 },
  noteRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noteBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  noteText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  infoBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 18, gap: 10 },
  infoLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  infoBody: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 18, color: color.textMuted },
  infoLink: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.verified },
});
