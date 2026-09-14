import { StyleSheet, Text, View } from 'react-native';
import { Diamond } from './Diamond';
import { color, fontFamily } from '../theme/tokens';

type Variant = 'verified' | 'adminEntered' | 'live' | 'neutral';

type Props = {
  variant: Variant;
  label: string;
  style?: object;
};

/** Badges & indicators — design system §5. */
export function StatusBadge({ variant, label, style }: Props) {
  const cfg = configFor(variant);
  return (
    <View style={[styles.base, cfg.container, style]}>
      {cfg.icon}
      <Text style={[styles.label, { color: cfg.textColor }]}>{label}</Text>
    </View>
  );
}

function configFor(variant: Variant) {
  switch (variant) {
    case 'verified':
      return {
        container: { backgroundColor: color.verifiedTint, borderColor: color.verifiedTintBorder },
        textColor: color.verified,
        icon: <Diamond size={8} color={color.verified} />,
      };
    case 'adminEntered':
      return {
        container: { borderColor: color.neutralBorder },
        textColor: color.textMuted,
        icon: <View style={styles.hollowSquare} />,
      };
    case 'live':
      return {
        container: { backgroundColor: color.emberTint, borderColor: color.emberTintBorder },
        textColor: color.ember,
        icon: <View style={styles.liveDot} />,
      };
    case 'neutral':
    default:
      return {
        container: { borderColor: color.neutralBorder },
        textColor: color.textPrimary,
        icon: null,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  label: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.12 * 10,
  },
  hollowSquare: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: color.textMuted,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: color.ember,
  },
});
