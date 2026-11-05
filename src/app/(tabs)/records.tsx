import { Link, router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useJournals } from '@/api/queries';
import type { Journal } from '@/api/types';
import { Button } from '@/components/form';
import { Card, EmptyView, ErrorView, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { formatDateTime } from '@/lib/format';

// SCR-05 내 기록 — 일지 목록 (TODO: 대시보드 FR-13)
export default function RecordsScreen() {
  const journals = useJournals();

  return (
    <Screen title="내 기록">
      <Button label="+ 새 낚시일지" onPress={() => router.push('/journal/new')} />

      {journals.isPending && <Loading />}
      {journals.isError && <ErrorView message={journals.error.message} onRetry={() => journals.refetch()} />}
      {journals.isSuccess &&
        (journals.data.length === 0 ? (
          <EmptyView message="아직 작성한 낚시일지가 없습니다." />
        ) : (
          journals.data.map((j) => <JournalRow key={j.id} journal={j} />)
        ))}
    </Screen>
  );
}

function JournalRow({ journal: j }: { journal: Journal }) {
  const catchText = [
    j.species_name,
    j.count != null ? `${j.count}마리` : null,
    j.max_length_cm != null ? `최대 ${j.max_length_cm}cm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={{ pathname: '/journal/[id]', params: { id: String(j.id) } }} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateTime(j.fished_at)}
          </ThemedText>
          <ThemedText type="smallBold">{j.place_name}</ThemedText>
          <ThemedText>{catchText || '조과 정보 없음'}</ThemedText>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});
