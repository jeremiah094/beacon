import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '../../theme/tokens';

type Tone = 'neutral' | 'verified' | 'ember';

export function AdminChip({ label, tone = 'neutral', dotShape = 'square' }: { label: string; tone?: Tone; dotShape?: 'square' | 'circle' | 'diamond' }) {
  const cfg =
    tone === 'verified'
      ? { fg: color.verified, bg: color.verifiedTint, border: color.verifiedTintBorder, dotFilled: true }
      : tone === 'ember'
        ? { fg: color.ember, bg: color.emberTint, border: color.emberTintBorder, dotFilled: true }
        : { fg: color.textPrimary, bg: 'transparent', border: color.neutralBorder, dotFilled: false };

  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View
        style={[
          dotShape === 'circle' ? styles.dotCircle : dotShape === 'diamond' ? styles.dotDiamond : styles.dotSquare,
          { borderColor: cfg.fg, backgroundColor: cfg.dotFilled ? cfg.fg : 'transparent' },
        ]}
      />
      <Text style={[styles.label, { color: cfg.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 11 },
  dotSquare: { width: 8, height: 8, borderWidth: 1 },
  dotCircle: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  dotDiamond: { width: 6, height: 6, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.12 * 10 },
});
