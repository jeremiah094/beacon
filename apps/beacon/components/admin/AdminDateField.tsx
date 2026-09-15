import { createElement } from 'react';
import { Platform, TextInput } from 'react-native';
import { color, fontFamily } from '../../theme/tokens';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  style?: object;
};

const inputStyle = {
  height: 46,
  backgroundColor: color.panel,
  borderWidth: 1,
  borderColor: color.hairlineInput,
  color: color.textPrimary,
  fontFamily: fontFamily.interRegular,
  fontSize: 15,
  paddingHorizontal: 14,
};

/** Admin console is web-first (see AdminShell), so this renders a real
 * browser date picker there via a raw <input type="date"> — react-native-web
 * has no first-class wrapper for it, and it's the only reliable way to get
 * native picker UI without a new native-datepicker dependency this
 * web-only surface doesn't otherwise need. Falls back to a plain text
 * field on native so the admin routes still work if opened there. */
export function AdminDateField({ value, onChange, style }: Props) {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: { ...inputStyle, borderStyle: 'solid', colorScheme: 'dark', ...style },
    });
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={color.fillPlaceholder}
      style={[inputStyle, style]}
    />
  );
}
