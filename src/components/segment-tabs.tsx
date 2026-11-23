/**
 * 한 줄 탭 (2026-11-23 화면 재설계): 고른 탭의 내용만 아래 한 영역에서 바꿔 보여준다 (내용을 아래로 쌓지 않음).
 * 4개까지 화면 너비 안에 균등 배치 — 가로 스크롤 없음.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.value)}
            style={[styles.tab, on && { backgroundColor: Brand.teal }]}>
            <ThemedText type="smallBold" numberOfLines={1} style={{ color: on ? '#FFFFFF' : theme.text }}>
              {t.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, padding: 3, gap: 2 },
  tab: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
