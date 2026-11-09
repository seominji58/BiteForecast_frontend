import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Layout, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 탭 화면 공통 레이아웃 (재설계 v2 §2).
 * 한 줄 앱바(52pt, 단색 네이비) + 아래 내용만 스크롤. 앱바는 스크롤 영역 밖이라 내용이 가려지지 않는다.
 * - logo: 홈에서만 앱 로고를 제목 앞에 표시
 * - right: 오른쪽 보조 동작 (기본: 「설정」)
 */
export function TabScreen({
  title,
  logo,
  right,
  onRefresh,
  children,
}: {
  title: string;
  logo?: boolean;
  right?: ReactNode;
  /** 아래로 당겨 새로고침 (Promise 가 끝날 때까지 표시) */
  onRefresh?: () => Promise<unknown>;
  children: ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const pull = onRefresh
    ? () => {
        setRefreshing(true);
        onRefresh().finally(() => setRefreshing(false));
      }
    : undefined;
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <View style={styles.appBarInner}>
          <View style={styles.titleRow}>
            {logo ? <AppIcon name="fishing-index" size={16} badge /> : null}
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
          </View>
          {right ?? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push('/settings')}
              style={styles.pill}>
              <Text style={styles.pillText}>설정</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView
        refreshControl={pull ? <RefreshControl refreshing={refreshing} onRefresh={pull} /> : undefined}
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

/** 카드: 패딩 12 · 라운드 12 · 1px 경계선, 그림자 없음 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }, style]}>
      {children}
    </ThemedView>
  );
}

/** 섹션 제목: 15pt 굵게 + 오른쪽 「더보기 ›」 (장식 밑줄·아이콘 없음) */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="sectionTitle" accessibilityRole="header">
        {title}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <ThemedText type="small" themeColor="tint">
            {actionLabel} ›
          </ThemedText>
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
        style={({ pressed }) => [styles.retry, { borderColor: theme.tint, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText themeColor="tint" type="smallBold">
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
  appBar: { backgroundColor: Brand.navy },
  appBarInner: {
    height: Layout.appBarHeight,
    paddingHorizontal: Layout.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { color: Brand.onNavy, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { color: Brand.onNavy, fontSize: 12, fontWeight: '700' },
  content: {
    padding: Layout.screenPadding,
    gap: Layout.gap,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  tabContent: { paddingBottom: Layout.gap * 3 },
  stackContent: { paddingBottom: Layout.gap * 4 },
  card: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    gap: 8,
    borderWidth: 1,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  center: { padding: 24, alignItems: 'center' },
  retry: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
});
