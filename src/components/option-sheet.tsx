/** 아래에서 올라오는 간단한 선택 목록 (홈 조건 상자의 날짜·지역) */
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function OptionSheet<T extends string>({
  open,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  options: { value: T; label: string; sub?: string }[];
  value: T | null;
  onPick: (v: T) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 12 }]}>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        <ScrollView style={styles.list}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onPick(o.value);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElement, borderColor: on ? Brand.orange : theme.border },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.flex}>
                  <ThemedText type={on ? 'smallBold' : 'default'}>{o.label}</ThemedText>
                  {o.sub ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {o.sub}
                    </ThemedText>
                  ) : null}
                </View>
                {on ? <ThemedText style={{ color: Brand.orange }}>✓</ThemedText> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,20,40,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, maxHeight: '70%' },
  title: { marginBottom: 10 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, marginBottom: 8 },
});
