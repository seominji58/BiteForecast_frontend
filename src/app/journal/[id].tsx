import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { useDeleteJournal, useJournal, useSaveJournal } from '@/api/queries';
import type { Journal } from '@/api/types';
import { Button } from '@/components/form';
import { JournalForm } from '@/components/journal-form';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDateTime, formatEnvKind, formatEnvValue, METRIC_LABEL, pointResultMessage } from '@/lib/format';

// SCR-04/05 낚시일지 상세·수정·삭제
export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const journalId = Number(id);
  const journal = useJournal(journalId);
  const save = useSaveJournal(journalId);
  const remove = useDeleteJournal(journalId);

  const confirmDelete = () =>
    Alert.alert('일지 삭제', '삭제하면 이 기록으로 받은 포인트가 회수됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: (res) => {
              Alert.alert('삭제했습니다', pointResultMessage(res));
              router.back();
            },
            onError: (e) => Alert.alert('삭제하지 못했습니다', e.message),
          }),
      },
    ]);

  return (
    <StackScreen>
      {journal.isPending && <Loading />}
      {journal.isError && <ErrorView message={journal.error.message} onRetry={() => journal.refetch()} />}
      {journal.isSuccess && (
        <>
          <EnvSection journal={journal.data} />
          <JournalForm
            // 저장 후 서버 값으로 폼을 다시 초기화
            key={journal.data.updated_at}
            initial={journal.data}
            submitLabel="수정 저장"
            submitting={save.isPending}
            serverError={save.error?.message}
            onSubmit={(input) =>
              save.mutate(input, { onSuccess: (res) => Alert.alert('저장했습니다', pointResultMessage(res)) })
            }
          />
          <View style={styles.delete}>
            <Button label="일지 삭제" variant="danger" onPress={confirmDelete} disabled={remove.isPending} />
          </View>
        </>
      )}
    </StackScreen>
  );
}

/** 당시 인근 관측소 기록 (FR-10). 현장 조건으로 단정하지 않는다 */
function EnvSection({ journal }: { journal: Journal }) {
  return (
    <Card>
      <ThemedText type="smallBold">당시 인근 관측소 기록</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDateTime(journal.fished_at)} 전후 1시간 기준 · 실제 현장 조건과 다를 수 있습니다
      </ThemedText>
      {journal.env_snapshots.map((s) => {
        const kind = formatEnvKind(s);
        return (
          <View key={s.metric} style={styles.envRow}>
            <ThemedText style={styles.envLabel}>{METRIC_LABEL[s.metric]}</ThemedText>
            <ThemedText themeColor={s.value == null ? 'textSecondary' : 'text'}>{formatEnvValue(s)}</ThemedText>
            {kind && (
              <ThemedText type="small" themeColor="textSecondary">
                {kind}
                {s.distance_km != null ? ` · 관측소 ${s.distance_km}km` : ' · 거리 확인 불가'}
              </ThemedText>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  envRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  envLabel: { width: 48 },
  delete: { marginTop: Spacing.four },
});
