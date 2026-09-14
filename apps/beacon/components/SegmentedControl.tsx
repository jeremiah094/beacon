import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '../theme/tokens';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Track height — 42 in the design system reference, 44 on screen 01. */
  height?: number;
  style?: object;
};

/** Design system §4. */
export function SegmentedControl<T extends string>({ options, value, onChange, height = 42, style }: Props<T>) {
  return (
    <View style={[styles.track, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} style={styles.segment} onPress={() => onChange(opt.value)}>
            {({ hovered }: any) => (
              <View style={[styles.segmentInner, { height }, active && styles.segmentActive]}>
                <Text
                  style={[
                    styles.label,
                    active ? styles.labelActive : hovered && styles.labelHover,
                  ]}
                >
                  {opt.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: color.hairlineInput,
    backgroundColor: color.base,
  },
  segment: { flex: 1 },
  segmentInner: { alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: color.textPrimary },
  label: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted },
  labelActive: { fontFamily: fontFamily.interSemiBold, color: color.base },
  labelHover: { color: color.textPrimary },
});
