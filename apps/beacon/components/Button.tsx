import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CornerCut } from './CornerCut';
import { Diamond } from './Diamond';
import { color, fontFamily, minTouch, tabularNums } from '../theme/tokens';

type Variant = 'primary' | 'primaryEmber' | 'secondary' | 'ghost' | 'destructive';

type ButtonProps = {
  variant?: Variant;
  children: string;
  onPress?: (e: GestureResponderEvent) => void;
  /** primaryEmber only — the inline remaining-time pill (design system §3). */
  countdown?: string;
  disabled?: boolean;
  style?: object;
};

/**
 * Button — design system §3. Six states live here: the five pressable
 * variants plus disabled. Loading/success replace the whole control — use
 * WorkingButton / DoneButton for those, and BlockedButton for the
 * "blocked, never bare" pattern (a control paired with a reason it's off).
 */
export function Button({ variant = 'primary', children, onPress, countdown, disabled, style }: ButtonProps) {
  if (variant === 'primary' || variant === 'primaryEmber') {
    const ember = variant === 'primaryEmber';
    return (
      <Pressable onPress={onPress} disabled={disabled} style={style}>
        {({ pressed, hovered }: any) => (
          <CornerCut
            cut={10}
            fill={
              ember
                ? pressed
                  ? color.emberActive
                  : hovered
                    ? color.emberHover
                    : color.ember
                : pressed
                  ? color.fillActive
                  : hovered
                    ? color.fillHover
                    : color.textPrimary
            }
            strokeColor="transparent"
            style={styles.primaryOuter}
          >
            <View style={styles.primaryContent}>
              <Text style={[styles.primaryLabel, { color: color.base }]}>{children}</Text>
              {countdown ? (
                <Text style={[styles.countdownInline, { color: color.base }, tabularNums]}>
                  {countdown}
                </Text>
              ) : null}
            </View>
          </CornerCut>
        )}
      </Pressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={style}>
        {({ pressed, hovered }: any) => (
          <View
            style={[
              styles.secondary,
              (pressed || hovered) && { borderColor: color.textPrimary, backgroundColor: color.fillMuted },
            ]}
          >
            <Text style={styles.secondaryLabel}>{children}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={style}>
        {({ pressed, hovered }: any) => (
          <View style={styles.ghost}>
            <Text style={[styles.ghostLabel, (pressed || hovered) && { color: color.textPrimary }]}>
              {children}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  // destructive
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {({ pressed, hovered }: any) => (
        <View style={[styles.destructive, (pressed || hovered) && { backgroundColor: color.emberTint }]}>
          <Text style={styles.destructiveLabel}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function WorkingButton({ label = 'Submitting…', style }: { label?: string; style?: object }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.working, style]}>
      <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
      <Text style={styles.workingLabel}>{label}</Text>
    </View>
  );
}

export function DoneButton({ label, style }: { label: string; style?: object }) {
  return (
    <View style={[styles.done, style]}>
      <Diamond size={12} color={color.verified} />
      <Text style={styles.doneLabel}>{label}</Text>
    </View>
  );
}

type BlockedButtonProps = {
  children: string;
  reason: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
};

/** "Blocked, never bare" — a disabled control always paired with why + a way out. */
export function BlockedButton({ children, reason, actionLabel, onAction, style }: BlockedButtonProps) {
  return (
    <View style={style}>
      <View style={styles.blocked}>
        <Text style={styles.blockedLabel}>{children}</Text>
      </View>
      <View style={styles.blockedReasonRow}>
        <View style={styles.blockedBar} />
        <Text style={styles.blockedReason}>
          {reason}
          {actionLabel ? (
            <Text onPress={onAction} style={styles.blockedLink}>
              {'  ' + actionLabel}
            </Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const labelBase = {
  fontFamily: fontFamily.interSemiBold,
  fontSize: 15,
};

const styles = StyleSheet.create({
  primaryOuter: {
    height: minTouch,
    width: '100%',
  },
  primaryContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: { ...labelBase },
  countdownInline: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 15,
    opacity: 0.75,
  },
  secondary: {
    height: minTouch,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { ...labelBase, color: color.textPrimary },
  ghost: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontFamily: fontFamily.interMedium, fontSize: 14, color: color.textMuted },
  destructive: {
    height: 44,
    borderWidth: 1,
    borderColor: color.emberBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.ember },
  blocked: {
    height: minTouch,
    backgroundColor: color.fillMuted,
    borderWidth: 1,
    borderColor: color.fillMutedBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedLabel: { ...labelBase, color: 'rgba(242,241,236,0.35)' },
  blockedReasonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 10,
  },
  blockedBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: color.ember,
    marginTop: 2,
  },
  blockedReason: {
    flex: 1,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: color.textPrimary,
  },
  blockedLink: {
    color: color.verified,
    fontFamily: fontFamily.interMedium,
  },
  working: {
    height: minTouch,
    backgroundColor: color.fillMutedStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  spinner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.textMuted,
    borderTopColor: 'transparent',
  },
  workingLabel: { ...labelBase, color: color.textMuted },
  done: {
    height: minTouch,
    backgroundColor: color.verifiedTint,
    borderWidth: 1,
    borderColor: color.verifiedTintBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  doneLabel: { ...labelBase, color: color.verified },
});
