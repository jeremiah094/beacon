import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, fontFamily } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/hooks/useSession';
import { AdminButton } from './AdminButton';

/** Inline destructive-action confirmation — re-verifies the signed-in
 * admin's password via a real Supabase sign-in (the only way a client can
 * genuinely confirm a password; there's nothing local to compare against)
 * before calling `onConfirmed`. Matches the app's existing "row/card
 * transforms into a confirm panel" pattern (schedule.tsx's cancel-game,
 * teams.tsx's reject-team) rather than a modal overlay, which nothing else
 * in the app uses. */
export function PasswordConfirmPanel({
  label,
  warning,
  confirmLabel = 'Confirm',
  onCancel,
  onConfirmed,
}: {
  label: string;
  warning: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirmed: () => Promise<void> | void;
}) {
  const { session } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleConfirm() {
    const email = session?.user.email;
    if (!email || !password) return;
    setChecking(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setChecking(false);
      setError('Incorrect password.');
      return;
    }
    await onConfirmed();
    setChecking(false);
    setPassword('');
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.warning}>{warning}</Text>
      <TextInput
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        placeholder="Re-enter your password"
        placeholderTextColor={color.fillPlaceholder}
        secureTextEntry
        autoFocus
        style={styles.input}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AdminButton
          label={checking ? 'Checking…' : confirmLabel}
          variant="destructiveFilled"
          disabled={!password || checking}
          onPress={handleConfirm}
        />
        <Pressable onPress={onCancel}>
          <View style={styles.cancelBtn}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 11, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 16 },
  label: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.ember },
  warning: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  input: {
    height: 44,
    backgroundColor: color.base,
    borderWidth: 1,
    borderColor: color.hairlineInput,
    color: color.textPrimary,
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  error: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.ember },
  cancelBtn: { height: 42, paddingHorizontal: 16, justifyContent: 'center' },
  cancelLabel: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted },
});
