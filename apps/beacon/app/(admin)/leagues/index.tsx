import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { AdminShell } from '../../../components/admin/AdminShell';
import { AdminButton } from '../../../components/admin/AdminButton';
import { AdminChip } from '../../../components/admin/AdminChip';
import { Spinner } from '../../../components/Spinner';
import { color, fontFamily } from '../../../theme/tokens';
import { useAdminLeagues } from '../../../lib/api/adminLeagues';

// Not one of the 16 reference screens — necessary connective tissue: the
// sidebar's "Leagues" nav item and every per-league admin screen need
// somewhere to pick a league from.
export default function AdminLeaguesList() {
  const { data: leagues, isLoading } = useAdminLeagues();

  return (
    <AdminShell
      active="leagues"
      breadcrumbs={[{ label: 'Leagues' }]}
      title="LEAGUES"
      actions={<AdminButton label="Create league" onPress={() => router.push('/(admin)/leagues/create')} />}
    >
      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      ) : !leagues || leagues.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No leagues yet</Text>
          <Text style={styles.emptyBody}>Create your first league to start registering teams.</Text>
          <AdminButton label="Create league" onPress={() => router.push('/(admin)/leagues/create')} style={{ marginTop: 4 }} />
        </View>
      ) : (
        <View style={{ gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline }}>
          {leagues.map((l) => (
            <Pressable key={l.id} onPress={() => router.push(`/(admin)/leagues/${l.id}/teams` as any)}>
              {({ hovered }: any) => (
                <View style={[styles.row, hovered && { backgroundColor: 'rgba(242,241,236,0.04)' }]}>
                  <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName}>{l.name}</Text>
                    <Text style={styles.rowMeta}>
                      {l.registeredTeams} approved · {l.pendingTeams} pending
                    </Text>
                  </View>
                  <AdminChip label={l.status.toUpperCase()} tone={l.status === 'published' ? 'verified' : 'neutral'} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <AdminButton
                      label="Edit"
                      variant="secondary"
                      height={36}
                      onPress={() => router.push({ pathname: '/(admin)/leagues/create', params: { leagueId: l.id } } as any)}
                    />
                    <AdminButton
                      label="Schedule"
                      variant="secondary"
                      height={36}
                      onPress={() => router.push(`/(admin)/leagues/${l.id}/schedule` as any)}
                    />
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, paddingHorizontal: 20, backgroundColor: color.panel },
  rowName: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 19, color: color.textPrimary },
  rowMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 32, gap: 12, alignItems: 'flex-start' },
  emptyTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, color: color.textPrimary },
  emptyBody: { fontFamily: fontFamily.interRegular, fontSize: 13, color: color.textMuted },
});
