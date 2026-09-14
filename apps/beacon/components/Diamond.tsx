import { View } from 'react-native';

/** The rotated-square "diamond" mark used by verified badges, the masthead
 * ember dot, and the done-button icon. clip-path: polygon(50% 0,100% 50%,
 * 50% 100%,0 50%) in the source — a 45°-rotated square reproduces it exactly. */
export function Diamond({ size = 8, color: fill }: { size?: number; color: string }) {
  return (
    <View
      style={{
        width: size * 0.72,
        height: size * 0.72,
        backgroundColor: fill,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}
