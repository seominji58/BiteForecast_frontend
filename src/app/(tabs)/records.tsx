import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useJournals } from '@/api/queries';
import type { EnvSnapshot, Journal } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';

// SCR-05 낚시 기록 — 일지 목록 + 당시 인근 관측소 기록 요약 (FR-08, FR-10)
export default function RecordsScreen() {
  const journals = useJournals();

  return (
    <TabScreen title="낚시 기록">
      <Button label="기록 작성하기" icon="write" onPress={() => router.push('/journal/new')} />

      <SectionHeader title={`최근 낚시기록${journals.data ? ` (${journals.data.length})` : ''}`} />
      {journals.isPending && <Loading />}
      {journals.isError && <ErrorView message={journals.error.message} onRetry={() => journals.refetch()} />}
      {journals.isSuccess &&
        (journals.data.length === 0 ? (
          <EmptyView message="아직 작성한 낚시일지가 없습니다. 첫 기록을 남기면 포인트를 받아요." />
        ) : (
          journals.data.map((j) => <JournalRow key={j.id} journal={j} />)
        ))}
    </TabScreen>
  );
}

function envValue(snaps: EnvSnapshot[], metric: EnvSnapshot['metric']): string {
  const s = snaps.find((x) => x.metric === metric);
  return s?.value != null ? `${s.value} ${s.unit}` : '–';
}

function JournalRow({ journal: j }: { journal: Journal }) {
  const theme = useTheme();
  const catchText = [
    j.count != null ? `${j.count}마리` : null,
    j.max_length_cm != null ? `${j.max_length_cm}cm` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <Link href={{ pathname: '/journal/[id]', params: { id: String(j.id) } }} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
        <Card style={styles.row}>
          <View style={styles.art}>
            <AppIcon name="cat-catch" size={40} />
          </View>
          <View style={styles.main}>
            <View style={styles.inline}>
              <AppIcon name="trips" size={15} />
              <ThemedText type="small" themeColor="textSecondary">
                {formatDateTime(j.fished_at)}
              </ThemedText>
            </View>
            <View style={styles.inline}>
              <AppIcon name="place-wharf" size={16} />
              <ThemedText type="smallBold">{j.place_name}</ThemedText>
            </View>
            <View style={[styles.catch, { backgroundColor: theme.tintSoft }]}>
              <ThemedText type="small" themeColor="tint" style={styles.bold}>
                {j.species_name ?? '어종 미기록'}
              </ThemedText>
              {catchText ? <ThemedText type="small">{catchText}</ThemedText> : null}
            </View>
          </View>
          {/* 당시 인근 관측소 기록 (현장 조건으로 단정하지 않음) */}
          <View style={[styles.env, { backgroundColor: theme.background }]}>
            <EnvLine icon="wave" label="파고" value={envValue(j.env_snapshots, 'wave_height')} />
            <EnvLine icon="wind" label="바람" value={envValue(j.env_snapshots, 'wind_speed')} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function EnvLine({ icon, label, value }: { icon: 'wave' | 'wind'; label: string; value: string }) {
  return (
    <View style={styles.inline}>
      <AppIcon name={icon} size={16} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.bold}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two + 2 },
  art: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6F9' },
  main: { flex: 1, gap: 3 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catch: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bold: { fontWeight: '700' },
  env: { borderRadius: 10, padding: Spacing.two, gap: 4 },
});
