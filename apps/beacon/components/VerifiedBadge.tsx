import { StyleSheet, Text, View } from 'react-native';
import { Diamond } from './Diamond';
import { color, fontFamily } from '../theme/tokens';
import { formatRelativeTime } from '../lib/time';

type Props = {
  /** When the underlying value was pulled from the Apex API. */
  fetchedAt: Date | string;
  /** Admin-entered values never borrow the verified mark — pass stale for
   * the "cache may be out of date" fallback described in BUILD.md §4. */
  stale?: boolean;
  style?: object;
};

/** The inline "EA VERIFIED · 4 MIN AGO" freshness line — design system §6. */
export function VerifiedBadge({ fetchedAt, stale, style }: Props) {
  if (stale) {
    return (
      <Text style={[styles.staleText, style]}>
        Stats may be out of date · synced {formatRelativeTime(fetchedAt).toLowerCase()}
      </Text>
    );
  }
  return (
    <View style={[styles.row, style]}>
      <Diamond size={8} color={color.verified} />
      <Text style={styles.label}>
        EA VERIFIED · {formatRelativeTime(fetchedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  label: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.12 * 10,
    color: color.verified,
  },
  staleText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: color.textMuted,
  },
});
