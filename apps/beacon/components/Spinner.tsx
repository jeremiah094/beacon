import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { color } from '../theme/tokens';

/** The beacon-spin ring — 0.7s linear, used standalone and inside WorkingButton. */
export function Spinner({ size = 12, strokeColor = color.textMuted, style }: { size?: number; strokeColor?: string; style?: object }) {
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
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: size >= 16 ? 1.5 : 1.5,
          borderColor: strokeColor,
          borderTopColor: 'transparent',
          transform: [{ rotate }],
        },
        style,
      ]}
    />
  );
}
