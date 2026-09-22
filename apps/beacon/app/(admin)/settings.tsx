import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminButton } from '../../components/admin/AdminButton';
import { Diamond } from '../../components/Diamond';
import { Spinner } from '../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../theme/tokens';
import { REGIONS } from '../../lib/leagueOptions';
import { useLeagueDefaults, useSaveLeagueDefaults } from '../../lib/api/adminSettings';

// Not one of the 16 reference screens — the sidebar's "Settings" item was a
// disabled placeholder with no defined scope. This covers the league-wide
// defaults that were otherwise hardcoded: default region and teams-per-
// lobby for a new league (create.tsx), and the map pool schedule.tsx picks
// from — there's no per-league map pool field in the schema, so this is
// the one global pool every league's schedule draws from.
export default function AdminSettings() {
  const { data: defaults, isLoading } = useLeagueDefaults();
  const save = useSaveLeagueDefaults();

  const [region, setRegion] = useState(REGIONS[0]);
  const [teams, setTeams] = useState(20);
  const [maps, setMaps] = useState<string[]>([]);
  const [newMap, setNewMap] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (defaults && !loaded) {
      setRegion(defaults.region);
      setTeams(defaults.teamsPerLobby);
      setMaps(defaults.maps);
      setLoaded(true);
    }
  }, [defaults, loaded]);

  const dirty =
    loaded &&
    defaults &&
    (region !== defaults.region || teams !== defaults.teamsPerLobby || maps.join('|') !== defaults.maps.join('|'));

  async function handleSave() {
    await save.mutateAsync({ region, teamsPerLobby: teams, maps });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  }

  function addMap() {
    const name = newMap.trim();
    if (!name || maps.includes(name)) return;
    setMaps((m) => [...m, name]);
    setNewMap('');
  }

  function removeMap(name: string) {
    setMaps((m) => m.filter((x) => x !== name));
  }

  if (isLoading || !loaded) {
    return (
      <AdminShell active="settings" breadcrumbs={[{ label: 'Settings' }]} title="SETTINGS">
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="settings"
      breadcrumbs={[{ label: 'Settings' }]}
      title="SETTINGS"
      titleMeta="League defaults"
      actions={
        <AdminButton
          label={justSaved ? 'Saved' : 'Save defaults'}
          disabled={!dirty || save.isPending}
          onPress={handleSave}
        />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Default region</Text>
        <Text style={styles.sectionHint}>Pre-filled when creating a new league.</Text>
        <View style={styles.chipRow}>
          {REGIONS.map((r) => (
            <Pressable key={r} onPress={() => setRegion(r)}>
              <View style={[styles.optionChip, region === r ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
                <Text style={[styles.optionChipLabel, region === r && { color: color.base }]}>{r}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Default teams per lobby</Text>
        <Text style={styles.sectionHint}>Pre-filled when creating a new league. 20 is the max a single Apex custom lobby holds.</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Stepper disabled={teams <= 8} onPress={() => setTeams((t) => Math.max(8, t - 1))} label="−" />
          <Text style={[styles.teamsValue, tabularNums]}>{teams}</Text>
          <Stepper disabled={teams >= 20} onPress={() => setTeams((t) => Math.min(20, t + 1))} label="+" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Map pool</Text>
        <Text style={styles.sectionHint}>The maps offered on the Schedule screen when publishing a game, for every league.</Text>
        <View style={styles.chipRow}>
          {maps.map((m) => (
            <View key={m} style={styles.mapChip}>
              <Text style={styles.mapChipLabel}>{m}</Text>
              <Pressable onPress={() => removeMap(m)} hitSlop={8}>
                <Text style={styles.mapChipRemove}>✕</Text>
              </Pressable>
            </View>
          ))}
          {maps.length === 0 && <Text style={styles.emptyMapsText}>No maps in the pool — add at least one below.</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={newMap}
            onChangeText={setNewMap}
            placeholder="Add a map…"
            placeholderTextColor={color.fillPlaceholder}
            onSubmitEditing={addMap}
            style={styles.mapInput}
          />
          <Pressable onPress={addMap} disabled={!newMap.trim()}>
            <View style={[styles.addMapBtn, !newMap.trim() && { opacity: 0.4 }]}>
              <Text style={styles.addMapBtnLabel}>Add</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {justSaved && (
        <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
          <Diamond size={9} color={color.verified} />
          <Text style={styles.savedText}>Defaults saved.</Text>
        </View>
      )}
    </AdminShell>
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

const styles = StyleSheet.create({
  section: { gap: 12, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 20 },
  sectionLabel: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 17, letterSpacing: 0.02 * 17, color: color.textPrimary },
  sectionHint: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  optionChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  stepperButton: { width: 34, height: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperButtonLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 17 },
  teamsValue: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26, minWidth: 34, textAlign: 'center', color: color.textPrimary },
  mapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  mapChipRemove: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  emptyMapsText: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  mapInput: {
    flex: 1,
    height: 42,
    backgroundColor: color.base,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    color: color.textPrimary,
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    paddingHorizontal: 12,
  },
  addMapBtn: { height: 42, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.hairlineStrong },
  addMapBtnLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textPrimary },
  savedText: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.verified },
});
