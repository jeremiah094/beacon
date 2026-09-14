import { StyleSheet, Text, View } from 'react-native';
import { TeamMark } from './TeamMark';
import { color, fontFamily, tabularNums } from '../theme/tokens';

type Props = {
  rank: number;
  initials: string;
  name: string;
  meta: string;
  points: number;
  /** The signed-in player's own team — design system §6. */
  isSelf?: boolean;
  style?: object;
};

/** 64px tabular row inside a Panel — league/division standings. */
export function StandingsRow({ rank, initials, name, meta, points, isSelf, style }: Props) {
  return (
    <View style={[styles.row, isSelf && styles.rowSelf, style]}>
      <Text style={[styles.rank, isSelf && { color: color.textPrimary }, tabularNums]}>
        {String(rank).padStart(2, '0')}
      </Text>
      <TeamMark initials={initials} emphasis={isSelf} size={32} />
      <View style={styles.info}>
        <Text style={styles.name}>
          {name}
          {isSelf ? <Text style={styles.youTag}> · you</Text> : null}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Text style={[styles.points, tabularNums]}>{points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  rowSelf: { backgroundColor: color.rowHighlight },
  rank: { fontFamily: fontFamily.rajdhaniBold, fontSize: 16, width: 22, color: color.textMuted },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: color.textPrimary },
  youTag: { fontFamily: fontFamily.interRegular, color: color.textMuted },
  meta: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted },
  points: { fontFamily: fontFamily.rajdhaniBold, fontSize: 20, color: color.textPrimary },
});
