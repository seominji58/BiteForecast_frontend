import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useJournals } from '@/api/queries';
import type { EnvSnapshot, Journal } from '@/api/types';
import { Button } from '@/components/form';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';

// SCR-05 낚시 기록 — 일지 목록 + 당시 인근 관측소 기록 요약 (FR-08, FR-10)
export default function RecordsScreen() {
  const journals = useJournals();

  return (
    <TabScreen title="낚시 기록" subtitle="출조 기록과 당시 바다 조건을 함께 남겨보세요.">
      <Button label="기록 작성하기" icon="pencil-plus" onPress={() => router.push('/journal/new')} />

      <SectionHeader icon="hook" title={`최근 낚시기록${journals.data ? ` (${journals.data.length})` : ''}`} />
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
          <LinearGradient colors={[Brand.teal, Brand.navy]} style={styles.art}>
            <MaterialCommunityIcons name="fish" size={24} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
          <View style={styles.main}>
            <View style={styles.inline}>
              <MaterialCommunityIcons name="calendar-month-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {formatDateTime(j.fished_at)}
              </ThemedText>
            </View>
            <View style={styles.inline}>
              <MaterialCommunityIcons name="map-marker" size={15} color={Brand.orange} />
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
            <EnvLine icon="waves-arrow-up" label="파고" value={envValue(j.env_snapshots, 'wave_height')} />
            <EnvLine icon="weather-windy" label="바람" value={envValue(j.env_snapshots, 'wind_speed')} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function EnvLine({ icon, label, value }: { icon: 'waves-arrow-up' | 'weather-windy'; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.inline}>
      <MaterialCommunityIcons name={icon} size={14} color={theme.tint} />
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
  art: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
