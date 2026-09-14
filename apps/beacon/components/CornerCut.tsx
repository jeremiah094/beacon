import { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { color, radius } from '../theme/tokens';

function cutPoints(w: number, h: number, cut: number) {
  return `0,0 ${w - cut},0 ${w},${cut} ${w},${h} 0,${h}`;
}

const ABSOLUTE_FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

type Props = Omit<ViewProps, 'style'> & {
  /** Corner cut size in px — 18 for HUD panels, 10 for buttons (design system §6/§3). */
  cut?: number;
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Reproduces the source's clip-path corner-cut (top-right) with an SVG
 * background instead of CSS clip-path, which React Native doesn't support.
 * Renders its own background — children should not set backgroundColor.
 */
export function CornerCut({
  cut = radius.panelCut,
  fill = color.panel,
  strokeColor = color.hairline,
  strokeWidth = 1,
  style,
  children,
  ...rest
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
      {...rest}
    >
      {size.width > 0 && size.height > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={ABSOLUTE_FILL}
          pointerEvents="none"
        >
          <Polygon
            points={cutPoints(size.width, size.height, cut)}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </Svg>
      )}
      {children}
    </View>
  );
}
