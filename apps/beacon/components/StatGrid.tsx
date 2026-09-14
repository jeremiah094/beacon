import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily, tabularNums } from '../theme/tokens';

export type Stat = { value: string; label: string; emphasis?: boolean };

/**
 * The hairline-ruled stat grid inside a HUD panel — "2.41 K/D · 118 WINS ·
 * D2 RANK" (design system §6). Wraps to 2 columns under 3 tiles' width so it
 * still reads at 390pt.
 */
export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.grid}>
      {stats.map((s, i) => (
        <View key={i} style={styles.tile}>
          <Text style={[styles.value, s.emphasis && { color: color.ember }, tabularNums]}>{s.value}</Text>
          <Text style={styles.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: color.hairline,
    gap: 1,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: color.panel,
    padding: 14,
    gap: 4,
  },
  value: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 26,
    lineHeight: 26,
    color: color.textPrimary,
  },
  label: {
    fontFamily: fontFamily.interRegular,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: color.textMuted,
  },
});
