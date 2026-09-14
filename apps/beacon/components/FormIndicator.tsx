import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '../theme/tokens';

export type FormResult = 'win' | 'loss' | 'none';

/** Last-five results strip — ember reads as a loss only here (design system §5). */
export function FormIndicator({ results, style }: { results: FormResult[]; style?: object }) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.bars}>
        {results.map((r, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: barColor(r) }]} />
        ))}
      </View>
      <Text style={styles.label}>FORM</Text>
    </View>
  );
}

function barColor(r: FormResult) {
  if (r === 'win') return color.verified;
  if (r === 'loss') return color.ember;
  return 'rgba(242,241,236,0.16)';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { width: 14, height: 4 },
  label: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 13,
    letterSpacing: 0.1 * 13,
    color: color.textMuted,
  },
});
