import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReport } from '@/api/queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_REASONS } from '@/lib/community';

/**
 * 신고 사유 선택 (앱스토어 사용자 생성 콘텐츠 정책: 신고 수단 필수).
 * Alert 버튼 수 제한(안드로이드 3개)을 피하려고 하단 시트로 만든다.
 */
export function ReportSheet({
  target,
  onClose,
}: {
  target: { type: 'post' | 'comment'; id: number } | null;
  onClose: () => void;
}) {
  const report = useReport();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const send = (reason: string) => {
    if (!target) return;
    report.mutate(
      { ...target, reason },
      {
        onSuccess: (r) => {
          onClose();
          Alert.alert(
            '신고 접수',
            r.status === 'already_reported'
              ? '이미 신고한 내용입니다.'
              : r.hidden
                ? '신고가 접수되었고, 누적 신고로 숨김 처리되었습니다.'
                : '신고가 접수되었습니다. 검토 후 조치하겠습니다.',
          );
        },
        onError: (e) => Alert.alert('신고하지 못했습니다', e.message),
      },
    );
  };

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기">
        <ThemedView
          type="backgroundElement"
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}
          onStartShouldSetResponder={() => true}>
          <ThemedText type="sectionTitle">신고 사유</ThemedText>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              disabled={report.isPending}
              onPress={() => send(r)}
              style={({ pressed }) => [styles.item, { borderColor: theme.border }, pressed && styles.pressed]}>
              <ThemedText>{r}</ThemedText>
            </Pressable>
          ))}
          <View style={styles.cancel}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <ThemedText themeColor="textSecondary">취소</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.three, gap: Spacing.one },
  item: { paddingVertical: Spacing.three - 2, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.6 },
  cancel: { alignItems: 'center', paddingTop: Spacing.three },
});
