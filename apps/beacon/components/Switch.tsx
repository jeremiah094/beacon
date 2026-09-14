import { Pressable, View, StyleSheet } from 'react-native';
import { color } from '../theme/tokens';

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
  style?: object;
};

/** Toggle — design system §4. Square knob, not a circle. */
export function Switch({ value, onChange, style }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.track, { backgroundColor: value ? 'rgba(62,213,152,0.9)' : color.fillMutedStrong }, style]}
    >
      <View style={[styles.knob, { backgroundColor: value ? color.base : color.textMuted }, value && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: { width: 20, height: 20 },
  knobOn: { marginLeft: 'auto' },
});
