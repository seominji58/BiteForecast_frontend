import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 탭 화면 공통 레이아웃 */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle" accessibilityRole="header">
            {title}
          </ThemedText>
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {children}
    </ThemedView>
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
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  center: { padding: Spacing.four, alignItems: 'center' },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
});
