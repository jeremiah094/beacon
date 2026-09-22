import { createElement } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { color, fontFamily } from '../../theme/tokens';

type Option = { value: string; label: string };

type Props = {
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  style?: object;
};

const inputStyle = { height: 34, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontFamily: fontFamily.interSemiBold, fontSize: 11, paddingHorizontal: 10 };

export function AdminSelectField({ value, options, placeholder, onChange, style }: Props) {
  if (Platform.OS === 'web') {
    return createElement(
      'select',
      {
        value,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: { ...inputStyle, borderStyle: 'solid', colorScheme: 'dark', ...style },
      },
      [
        placeholder != null && createElement('option', { key: '__placeholder', value: '', disabled: true }, placeholder),
        ...options.map((o) => createElement('option', { key: o.value, value: o.value }, o.label)),
      ].filter(Boolean),
    );
  }

  const current = options.find((o) => o.value === value);
  return (
    <Pressable
      onPress={() => {
        const idx = options.findIndex((o) => o.value === value);
        const next = options[(idx + 1) % options.length];
        onChange(next.value);
      }}
    >
      <Text style={[{ fontFamily: fontFamily.interSemiBold, fontSize: 11, color: color.textPrimary }, style]}>{current?.label ?? placeholder ?? ''}</Text>
    </Pressable>
  );
}
