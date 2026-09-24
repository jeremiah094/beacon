import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { color, fontFamily } from '../theme/tokens';

type Props = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

/** Shared chrome for the Privacy Policy and Terms of Service screens —
 * both are plain scrollable text, reachable the same way on every
 * platform (web footer/nav, native Settings), so there's no reason for
 * either to redefine the header/back-button/scroll boilerplate. */
export function LegalPageShell({ title, updated, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
          <Ionicons name={Platform.OS === 'web' ? 'arrow-back' : 'chevron-back'} size={22} color={color.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>Last updated {updated}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  title: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 18, color: color.textPrimary },
  scroll: { padding: 22, paddingBottom: 60, gap: 22, maxWidth: 680, width: '100%', alignSelf: 'center' },
  updated: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted },
  sectionHeading: { fontFamily: fontFamily.rajdhaniSemiBold, fontSize: 18, color: color.textPrimary },
  paragraph: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 21, color: color.textMuted },
});
