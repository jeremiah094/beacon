import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '../theme/tokens';

/**
 * Per-character code cells — design system §4, and the hero display on the
 * match lobby screen. `activeIndex` puts the ember caret in that cell.
 */
export function CodeEntry({
  length = 5,
  chars,
  activeIndex,
  style,
}: {
  length?: number;
  chars: string[];
  activeIndex?: number;
  style?: object;
}) {
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length }).map((_, i) => {
        const char = chars[i];
        const isActive = i === activeIndex;
        return (
          <View key={i} style={[styles.cell, isActive && styles.cellActive]}>
            {char ? <Text style={styles.char}>{char}</Text> : isActive ? <View style={styles.caret} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    aspectRatio: 1 / 1.15,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    backgroundColor: color.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: color.textPrimary },
  char: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 22,
    color: color.textPrimary,
  },
  caret: { width: 1, height: 22, backgroundColor: color.ember },
});
