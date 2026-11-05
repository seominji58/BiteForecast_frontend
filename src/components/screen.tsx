import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * 탭 화면 공통 레이아웃: 위에 고정된 짧은 그라데이션 헤더(로고·제목·설정) + 아래 내용만 스크롤.
 * 사진 대신 그라데이션·아이콘을 쓴다 (이미지 저작권).
 */
export function TabScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <LinearGradient
        colors={Brand.hero}
        locations={[0, 0.45, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + Spacing.one }}>
        <View style={styles.heroInner}>
          <View style={styles.heroTop}>
            <View style={styles.logo} accessibilityLabel="입질예보">
              <MaterialCommunityIcons name="fish" size={20} color={Brand.onNavy} />
              <Text style={styles.logoText}>입질예보</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="설정"
              hitSlop={12}
              onPress={() => router.push('/settings')}>
              <MaterialCommunityIcons name="cog-outline" size={22} color={Brand.onNavy} />
            </Pressable>
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
      <ScrollView
        contentContainerStyle={[styles.content, styles.tabContent]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

/** Stack 으로 이동한 화면용 (제목은 네비게이션 헤더가 표시) */
export function StackScreen({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, styles.stackContent]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }, style]}>
      {children}
    </ThemedView>
  );
}

/** 섹션 제목: 아이콘 + 제목 + 주황 밑줄, 오른쪽에 「더보기」 같은 동작 */
export function SectionHeader({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name={icon} size={18} color={theme.tint} />
          <ThemedText type="sectionTitle" accessibilityRole="header">
            {title}
          </ThemedText>
        </View>
        <View style={[styles.underline, { backgroundColor: theme.accent }]} />
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.sectionAction}>
          <ThemedText type="small" themeColor="textSecondary">
            {actionLabel}
          </ThemedText>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.center} accessibilityLabel="불러오는 중">
      <ActivityIndicator color={theme.tint} />
    </View>
  );
}

/** 오류 안내 + 재시도 (NFR-04) */
export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <Card>
      <ThemedText themeColor="danger">{message}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText themeColor="onTint" type="smallBold">
          다시 시도
        </ThemedText>
      </Pressable>
    </Card>
  );
}

export function EmptyView({ message }: { message: string }) {
  return (
    <Card>
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroInner: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: 2,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { color: Brand.onNavy, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  heroTitle: { color: Brand.onNavy, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  heroSubtitle: { color: Brand.onNavySecondary, fontSize: 13, lineHeight: 18 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  tabContent: { paddingBottom: BottomTabInset + Spacing.three },
  stackContent: { paddingBottom: Spacing.six },
  card: {
    padding: Spacing.three - 2,
    borderRadius: 16,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0A1F36',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  underline: { height: 2, width: 32, borderRadius: 1, marginTop: 3, marginLeft: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center' },
  center: { padding: Spacing.four, alignItems: 'center' },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
});
