import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useState } from 'react';

import { useDeleteJournal, useJournal, useSaveJournal } from '@/api/queries';
import type { Journal } from '@/api/types';
import { Button } from '@/components/form';
import { JournalForm } from '@/components/journal-form';
import { AuthGate } from '@/components/login-required';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { formatDateTime, formatEnvKind, formatEnvValue, METRIC_LABEL, pointResultMessage } from '@/lib/format';

// SCR-04/05 낚시일지 상세: 그때 바다(한 줄, 펼치면 관측소) · 공유 → 수정 폼 → 삭제 (2026-11-23 사진 인증 없앰)
function JournalDetailScreenInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const journalId = Number(id);
  const journal = useJournal(journalId);
  const save = useSaveJournal(journalId);
  const remove = useDeleteJournal(journalId);

  const confirmDelete = () =>
    Alert.alert('일지 삭제', '삭제하면 이 기록의 사진도 지워지고, 이 기록으로 받은 포인트가 회수됩니다.', [
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
          <ShareCard journal={journal.data} />
          <JournalForm
            // 저장 후 서버 값으로 폼을 다시 초기화
            key={journal.data.updated_at}
            initial={journal.data}
            submitLabel="수정 저장"
            submitting={save.isPending}
            serverError={save.error?.message}
            onSubmit={(input) => save.mutate(input, { onSuccess: (res) => Alert.alert('저장했습니다', pointResultMessage(res)) })}
          />
          <View style={styles.delete}>
            <Button label="일지 삭제" variant="danger" onPress={confirmDelete} disabled={remove.isPending} />
          </View>
        </>
      )}
    </StackScreen>
  );
}

/** 공유 한 줄: 커뮤니티에 공유 / 공유한 글 보기 (2026-11-23 사진 인증 없앰 — 기록만으로 포인트) */
function ShareCard({ journal: j }: { journal: Journal }) {
  return j.shared_post_id ? (
    <Button
      label="공유한 글 보기"
      variant="secondary"
      onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(j.shared_post_id) } })}
    />
  ) : (
    <Button
      label="커뮤니티에 조황 공유"
      variant="secondary"
      onPress={() => router.push({ pathname: '/community/new', params: { journal: String(j.id) } })}
    />
  );
}

/** 당시 인근 관측소 기록 (FR-10): 한 줄 요약, 누르면 관측소·거리까지. 현장 조건으로 단정하지 않는다 */
function EnvSection({ journal }: { journal: Journal }) {
  const [open, setOpen] = useState(false);
  const have = journal.env_snapshots.filter((s) => s.value != null);
  const line = have.map((s) => `${METRIC_LABEL[s.metric]} ${formatEnvValue(s)}`).join(' · ');
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.between}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">그때 바다</ThemedText>
          <ThemedText type="small" themeColor={line ? 'text' : 'textSecondary'} numberOfLines={open ? undefined : 1}>
            {line || '가까운 관측소 기록이 없어요'}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="tint">
          {open ? '접기 ▴' : '자세히 ▾'}
        </ThemedText>
      </Pressable>
      {open ? (
        <>
          {journal.env_snapshots.map((s) => {
            const kind = formatEnvKind(s);
            return (
              <View key={s.metric} style={styles.envRow}>
                <ThemedText style={styles.envLabel}>{METRIC_LABEL[s.metric]}</ThemedText>
                <ThemedText themeColor={s.value == null ? 'textSecondary' : 'text'}>{formatEnvValue(s)}</ThemedText>
                {kind ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {kind}
                    {s.distance_km != null ? ` · 관측소 ${s.distance_km}km` : ''}
                  </ThemedText>
                ) : null}
              </View>
            );
          })}
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateTime(journal.fished_at)} 전후 1시간 · 인근 관측소 기록이라 현장과 다를 수 있어요
          </ThemedText>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  envRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  envLabel: { width: 48 },
  delete: { marginTop: 16 },
});

export default function JournalDetailScreen() {
  return (
    <AuthGate message="내 낚시 기록은 로그인 후 볼 수 있어요." icon="cat-catch">
      <JournalDetailScreenInner />
    </AuthGate>
  );
}
