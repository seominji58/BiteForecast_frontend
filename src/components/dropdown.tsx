import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DropdownOption<V extends string> = { value: V; label: string; hint?: string };

/**
 * 짧은 목록 선택 (재설계 v2 §2 Dropdown): 현재값 + ▾ 를 누르면 아래에서 작은 시트가 올라온다.
 * 카테고리·날짜처럼 항목이 적은 선택에 쓴다 (항목이 많으면 SearchSelect).
 */
export function Dropdown<V extends string>({
  label,
  value,
  options,
  onChange,
  compact,
  accessibilityLabel,
}: {
  /** 시트 제목 */
  label: string;
  value: V;
  options: DropdownOption<V>[];
  onChange: (v: V) => void;
  /** 목록 상단 툴바용 작은 크기 */
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel ?? label}: ${current?.label ?? '선택'}, 바꾸기`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          compact ? styles.compact : styles.field,
          { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 },
        ]}>
        <ThemedText type={compact ? 'smallBold' : 'default'} numberOfLines={1} style={styles.shrink}>
          {current?.label ?? '선택'}
        </ThemedText>
        <ThemedText type="small" themeColor="tint">
          ▾
        </ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="닫기" />
        <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.header}>
            <ThemedText type="sectionTitle">{label}</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setOpen(false)}>
              <ThemedText type="smallBold" themeColor="tint">
                닫기
              </ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: on ? Brand.orange : theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type={on ? 'smallBold' : 'default'} style={styles.shrink}>
                    {o.label}
                  </ThemedText>
                  {o.hint ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {o.hint}
                    </ThemedText>
                  ) : null}
                  {on ? (
                    <ThemedText type="smallBold" themeColor="accent">
                      ✓
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: Layout.screenPadding, gap: 8, paddingBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
