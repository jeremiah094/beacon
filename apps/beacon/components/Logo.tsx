import { Image, ImageStyle, StyleProp } from 'react-native';

/** The Beacon mark — three stacked chevrons on an ember glow, cropped from
 * the brand logo. Used anywhere the wordmark row needs the real mark
 * instead of the generic Diamond primitive. */
export function Logo({ size = 24, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../assets/logo-mark.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
