import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { useDeleteJournal, useJournal, useSaveJournal, useVerification } from '@/api/queries';
import type { Journal } from '@/api/types';
import { Button } from '@/components/form';
import { JournalForm } from '@/components/journal-form';
import { AuthGate } from '@/components/login-required';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { formatDateTime, formatEnvKind, formatEnvValue, METRIC_LABEL, pointResultMessage } from '@/lib/format';
import { VERIFY_LABEL } from '@/lib/verification';

// SCR-04/05 낚시일지 상세: 인증 상태·신청·공유 → 당시 관측소 기록 → 수정 폼 → 삭제
function JournalDetailScreenInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const journalId = Number(id);
  const journal = useJournal(journalId);
  const save = useSaveJournal(journalId);
  const remove = useDeleteJournal(journalId);

  const confirmDelete = () =>
    Alert.alert('일지 삭제', '삭제하면 이 기록의 사진도 지워지고, 인증으로 받은 포인트가 회수됩니다.', [
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
          <VerificationCard journal={journal.data} />
          <EnvSection journal={journal.data} />
          <JournalForm
            // 저장 후 서버 값으로 폼을 다시 초기화
            key={journal.data.updated_at + journal.data.verification.status}
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

/** 인증 상태와 다음 행동 (신청 · 취소 · 공유) */
function VerificationCard({ journal: j }: { journal: Journal }) {
  const verify = useVerification(j.id);
  const v = j.verification;
  const meta = VERIFY_LABEL[v.status];
  const run = (request: boolean) =>
    verify.mutate(request, {
      onSuccess: () =>
        Alert.alert(request ? '인증을 신청했어요' : '신청을 취소했어요', request ? '관리자가 확인하면 알려드려요.' : ''),
      onError: (e) => Alert.alert('처리하지 못했습니다', e.message),
    });

  return (
    <Card>
      <View style={styles.between}>
        <ThemedText type="sectionTitle" themeColor={meta.color}>
          {meta.label}
        </ThemedText>
        {v.points > 0 ? (
          <ThemedText type="smallBold" themeColor="success">
            +{v.points}P
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {meta.hint}
        {v.requested_at && v.status === 'pending' ? ` · 신청 ${formatDateTime(v.requested_at)}` : ''}
      </ThemedText>
      {v.status === 'rejected' && v.reject_reason ? (
        <ThemedText themeColor="danger">반려 사유: {v.reject_reason}</ThemedText>
      ) : null}
      {(v.status === 'none' || v.status === 'rejected') && !v.can_request ? (
        <ThemedText type="small" themeColor="textSecondary">
          신청하려면: {v.missing.join(', ')} (아래에서 추가 후 저장)
        </ThemedText>
      ) : null}

      {v.can_request ? (
        <Button
          label={v.status === 'rejected' ? '다시 인증 신청' : '인증 신청'}
          onPress={() => run(true)}
          disabled={verify.isPending}
        />
      ) : null}
      {v.status === 'pending' ? (
        <Button label="신청 취소" variant="secondary" onPress={() => run(false)} disabled={verify.isPending} />
      ) : null}
      {v.status === 'approved' ? (
        j.shared_post_id ? (
          <Button
            label="공유한 글 보기"
            variant="secondary"
            onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(j.shared_post_id) } })}
          />
        ) : (
          <Button
            label="커뮤니티에 인증 조황으로 공유"
            variant="secondary"
            onPress={() => router.push({ pathname: '/community/new', params: { journal: String(j.id) } })}
          />
        )
      ) : null}
    </Card>
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
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
