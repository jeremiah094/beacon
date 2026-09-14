import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Diamond } from './Diamond';
import { color, fontFamily } from '../theme/tokens';

type Props = TextInputProps & {
  label: string;
  helperText?: string;
  errorMessage?: string;
  /** Locked to read-only with the verified diamond — design system §4 "linked" state. */
  verified?: boolean;
  style?: object;
};

/** Rest / focus / linked / error — design system §4. */
export function TextField({
  label,
  helperText,
  errorMessage,
  verified,
  value,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const hasError = !!errorMessage;

  const labelColor = hasError ? color.ember : verified ? color.verified : focused ? color.textPrimary : color.textMuted;
  const borderColor = hasError ? color.ember : verified ? color.verifiedBorderStrong : focused ? color.textPrimary : color.hairlineInput;

  return (
    <View style={style}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <View style={[styles.field, { borderColor }]}>
        <TextInput
          value={value}
          editable={!verified}
          placeholderTextColor={color.fillPlaceholder}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {verified ? (
          <View style={styles.verifiedTag}>
            <Diamond size={9} color={color.verified} />
            <Text style={styles.verifiedTagLabel}>VERIFIED</Text>
          </View>
        ) : null}
      </View>
      {hasError ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  field: {
    height: 50,
    borderWidth: 1,
    backgroundColor: color.base,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    color: color.textPrimary,
    height: '100%',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedTagLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: color.verified,
  },
  helperText: {
    marginTop: 10,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: color.textMuted,
  },
  errorText: {
    marginTop: 10,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: color.textPrimary,
  },
});
