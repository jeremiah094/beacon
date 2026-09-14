import { Pressable, Text, View } from 'react-native';
import { CornerCut } from '../CornerCut';
import { color, fontFamily } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'destructiveOutline' | 'destructiveFilled';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  height?: number;
  style?: object;
};

/** Admin console buttons — square-corner secondary, corner-cut primary
 * (10px cut on the 52px docked actions, 9px on the 42-44px top-bar ones). */
export function AdminButton({ label, onPress, variant = 'primary', disabled, height = 42, style }: Props) {
  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={style}>
        {({ pressed, hovered }: any) => (
          <CornerCut
            cut={height >= 50 ? 10 : 9}
            fill={disabled ? color.fillMuted : pressed ? color.fillActive : hovered ? color.fillHover : color.textPrimary}
            strokeColor={disabled ? color.fillMutedBorder : 'transparent'}
            style={{ height }}
          >
            <View style={{ flex: 1, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fontFamily.interSemiBold, fontSize: 13, color: disabled ? 'rgba(242,241,236,0.35)' : color.base }}>
                {label}
              </Text>
            </View>
          </CornerCut>
        )}
      </Pressable>
    );
  }

  if (variant === 'destructiveFilled') {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={style}>
        {({ hovered }: any) => (
          <View
            style={{
              height,
              paddingHorizontal: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hovered ? 'rgba(255,90,54,0.22)' : color.emberTint,
              borderWidth: 1,
              borderColor: color.emberBorderStrong,
            }}
          >
            <Text style={{ fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.ember }}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  const isDestructive = variant === 'destructiveOutline';
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {({ pressed, hovered }: any) => (
        <View
          style={{
            height,
            paddingHorizontal: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDestructive ? color.emberBorderStrong : color.hairlineStrong,
            backgroundColor: (pressed || hovered) && !isDestructive ? color.fillMuted : (pressed || hovered) && isDestructive ? color.emberTint : 'transparent',
          }}
        >
          <Text style={{ fontFamily: fontFamily.interSemiBold, fontSize: 13, color: isDestructive ? color.ember : color.textPrimary }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
