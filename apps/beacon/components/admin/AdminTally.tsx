import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily, tabularNums } from '../../theme/tokens';

export type Tally = { n: number | string; label: string; fg?: string };

export function AdminTallyRow({ items }: { items: Tally[] }) {
  return (
    <View style={styles.row}>
      {items.map((t, i) => (
        <View key={i} style={styles.cell}>
          <Text style={[styles.n, { color: t.fg ?? color.textPrimary }, tabularNums]}>{t.n}</Text>
          <Text style={styles.label}>{t.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps instead of running off a phone screen; cells grow to share each
  // line, so a wrapped strip still reads as one filled block.
  row: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%', gap: 1, backgroundColor: color.hairline, borderWidth: 1, borderColor: color.hairline },
  cell: { backgroundColor: color.panel, paddingVertical: 12, paddingHorizontal: 18, gap: 5, minWidth: 104, flexGrow: 1 },
  n: { fontFamily: fontFamily.rajdhaniBold, fontSize: 26 },
  label: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
});
