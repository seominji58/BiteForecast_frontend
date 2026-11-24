/**
 * 아래에서 올라오는 시트 (2026-11-23 화면 재설계): 제목 · ✕ · 스크롤 본문.
 * 세부 자료(시간별 표·자료 출처·전체 비교표)를 본 화면에 쌓지 않고 여기서 연다.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  header,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 제목 아래 고정 영역 (예: 시트 안 탭) */
  header?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.grip, { backgroundColor: theme.border }]} />
        <View style={styles.head}>
          <ThemedText type="sectionTitle" style={styles.flex} numberOfLines={1}>
            {title}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} onPress={onClose} style={styles.close}>
            <ThemedText type="sectionTitle" themeColor="textSecondary">
              ✕
            </ThemedText>
          </Pressable>
        </View>
        {header}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '82%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  close: { padding: 4 },
  body: { flexGrow: 0 },
  bodyContent: { gap: 10, paddingBottom: 8 },
});
