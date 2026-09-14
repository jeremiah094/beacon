import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { CornerCut } from './CornerCut';
import { color, space } from '../theme/tokens';

type PanelProps = Omit<ViewProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Plain hairline-bordered, square-corner surface — standings rows, list cards. */
export function Panel({ style, children, ...rest }: PanelProps) {
  return (
    <View style={[styles.panel, style]} {...rest}>
      {children}
    </View>
  );
}

type HudPanelProps = Omit<ViewProps, 'style'> & {
  /** 'default' = hairline border. 'ember' = the border a live countdown/lock
   * warning takes on (design system §7, "locking" state). 'verified' = the
   * green border an account-linked/success panel takes on (screen 01). */
  variant?: 'default' | 'ember' | 'verified';
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

const strokeForVariant: Record<NonNullable<HudPanelProps['variant']>, string> = {
  default: color.hairline,
  ember: color.emberBorderSoft,
  verified: color.verifiedTintBorder,
};

/** Corner-cut "HUD panel" — stat and match-day cards (design system §6). */
export function HudPanel({ variant = 'default', style, contentStyle, children, ...rest }: HudPanelProps) {
  return (
    <CornerCut
      style={[styles.hudOuter, style]}
      strokeColor={strokeForVariant[variant]}
      fill={color.panel}
      {...rest}
    >
      <View style={[styles.hudContent, contentStyle]}>{children}</View>
    </CornerCut>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.panel,
  },
  hudOuter: {
    width: '100%',
  },
  hudContent: {
    padding: space(5.5), // 22px
    gap: space(4), // 16px
  },
});
