import { StyleSheet, Text, View } from 'react-native';
import { color, font } from '../theme/tokens';

/**
 * Temporary stand-in for a screen that hasn't been built yet. Every real
 * screen replaces one of these — see the build-order tasks in BUILD.md.
 */
export function Placeholder({ title, reference }: { title: string; reference: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.reference}>{reference}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontFamily: font.display,
    fontSize: 24,
    color: color.textPrimary,
  },
  reference: {
    fontFamily: font.body,
    fontSize: 13,
    color: color.textMuted,
  },
});
