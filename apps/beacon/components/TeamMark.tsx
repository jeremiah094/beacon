import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '../theme/tokens';

type Props = {
  initials: string;
  /** Emphasised = your own team (fuller border/text) — e.g. the "you" row
   * in standings (design system §6). */
  emphasis?: boolean;
  size?: number;
  style?: object;
};

/** Team mark — initials in a hairline square. No logo uploads at launch. */
export function TeamMark({ initials, emphasis, size = 34, style }: Props) {
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderColor: emphasis ? 'rgba(242,241,236,0.3)' : color.hairlineInput,
          backgroundColor: emphasis ? 'transparent' : color.fillMuted,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, emphasis && { color: color.textPrimary }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 13,
    color: color.textMuted,
  },
});
