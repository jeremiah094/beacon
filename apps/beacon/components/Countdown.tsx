import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily, tabularNums } from '../theme/tokens';
import { formatCountdown } from '../lib/time';

type Props = {
  target: Date | string;
  /** 'hero' = 52px (design system §7 "locking" state). 'stat' = 38px, matching
   * the K/D stat-hero size, for smaller inline countdowns. */
  size?: 'hero' | 'stat';
  caption?: string;
  onExpire?: () => void;
  style?: object;
};

/** Live ticking countdown — ember, tabular, always mm:ss (or hh:mm:ss). */
export function Countdown({ target, size = 'hero', caption, onExpire, style }: Props) {
  const targetMs = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = targetMs - now;
  useEffect(() => {
    if (remaining <= 0) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);

  return (
    <View style={[styles.row, style]}>
      <Text style={[size === 'hero' ? styles.hero : styles.stat, tabularNums]}>
        {formatCountdown(remaining)}
      </Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  hero: { fontFamily: fontFamily.rajdhaniBold, fontSize: 52, lineHeight: 52, color: color.ember },
  stat: { fontFamily: fontFamily.rajdhaniBold, fontSize: 38, lineHeight: 38, color: color.ember },
  caption: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 16, color: color.textMuted },
});
